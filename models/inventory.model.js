const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  variant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product_Varient",
    default: null
  },
  currentStock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  reservedStock: {
    type: Number,
    default: 0,
    min: 0
  },
  availableStock: {
    type: Number,
    default: 0,
    min: 0
  },
  reorderPoint: {
    type: Number,
    default: 10,
    min: 0
  },
  maxStock: {
    type: Number,
    default: 1000,
    min: 0
  },
  location: {
    warehouse: {
      type: String,
      default: "Main Warehouse"
    },
    section: {
      type: String,
      default: "A1"
    },
    shelf: {
      type: String,
      default: "1"
    }
  },
  costPrice: {
    type: Number,
    min: 0
  },
  supplier: {
    name: String,
    contact: String,
    email: String
  },
  lastRestocked: {
    type: Date,
    default: Date.now
  },
  alerts: {
    lowStock: {
      type: Boolean,
      default: false
    },
    outOfStock: {
      type: Boolean,
      default: false
    },
    overStock: {
      type: Boolean,
      default: false
    }
  },
  movements: [{
    type: {
      type: String,
      enum: ["IN", "OUT", "RESERVED", "UNRESERVED", "ADJUSTMENT", "RETURN"],
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    reason: {
      type: String,
      required: true
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User_Order"
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    notes: String
  }],
  metrics: {
    totalSold: {
      type: Number,
      default: 0
    },
    totalPurchased: {
      type: Number,
      default: 0
    },
    averageSalesPerDay: {
      type: Number,
      default: 0
    },
    daysOfStock: {
      type: Number,
      default: 0
    },
    turnoverRate: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Indexes for better performance
inventorySchema.index({ product: 1, variant: 1 }, { unique: true });
inventorySchema.index({ "alerts.lowStock": 1 });
inventorySchema.index({ "alerts.outOfStock": 1 });
inventorySchema.index({ reorderPoint: 1 });
inventorySchema.index({ lastRestocked: 1 });

// Pre-save middleware to calculate available stock and alerts
inventorySchema.pre('save', function(next) {
  // Calculate available stock
  this.availableStock = this.currentStock - this.reservedStock;
  
  // Update alerts
  this.alerts.outOfStock = this.availableStock <= 0;
  this.alerts.lowStock = this.availableStock > 0 && this.availableStock <= this.reorderPoint;
  this.alerts.overStock = this.currentStock > this.maxStock;
  
  // Calculate days of stock
  if (this.metrics.averageSalesPerDay > 0) {
    this.metrics.daysOfStock = Math.floor(this.availableStock / this.metrics.averageSalesPerDay);
  }
  
  next();
});

// Method to update stock
inventorySchema.methods.updateStock = function(quantity, type, reason, orderId = null, performedBy = null, notes = null) {
  const movement = {
    type,
    quantity: Math.abs(quantity),
    reason,
    orderId,
    performedBy,
    notes
  };
  
  switch(type) {
    case "IN":
      this.currentStock += Math.abs(quantity);
      this.metrics.totalPurchased += Math.abs(quantity);
      break;
    case "OUT":
      this.currentStock -= Math.abs(quantity);
      this.metrics.totalSold += Math.abs(quantity);
      break;
    case "RESERVED":
      this.reservedStock += Math.abs(quantity);
      break;
    case "UNRESERVED":
      this.reservedStock -= Math.abs(quantity);
      break;
    case "ADJUSTMENT":
      this.currentStock = Math.abs(quantity);
      break;
    case "RETURN":
      this.currentStock += Math.abs(quantity);
      break;
  }
  
  // Ensure stock doesn't go below 0
  this.currentStock = Math.max(0, this.currentStock);
  this.reservedStock = Math.max(0, this.reservedStock);
  
  // Add movement to history
  this.movements.push(movement);
  
  // Update last restocked date for IN movements
  if (type === "IN") {
    this.lastRestocked = new Date();
  }
  
  return this.save();
};

// Method to reserve stock
inventorySchema.methods.reserveStock = function(quantity, orderId, performedBy) {
  if (this.availableStock < quantity) {
    throw new Error("Insufficient stock available for reservation");
  }
  return this.updateStock(quantity, "RESERVED", "Order reservation", orderId, performedBy);
};

// Method to unreserve stock
inventorySchema.methods.unreserveStock = function(quantity, orderId, performedBy) {
  return this.updateStock(quantity, "UNRESERVED", "Order cancellation", orderId, performedBy);
};

// Method to fulfill order (convert reserved to sold)
inventorySchema.methods.fulfillOrder = function(quantity, orderId, performedBy) {
  return this.updateStock(quantity, "OUT", "Order fulfillment", orderId, performedBy);
};

// Static method to get low stock items
inventorySchema.statics.getLowStockItems = function() {
  return this.find({
    $or: [
      { "alerts.lowStock": true },
      { "alerts.outOfStock": true }
    ]
  }).populate("product", "productTitle skuNo")
    .populate("variant", "varientName")
    .sort({ availableStock: 1 });
};

// Static method to get stock summary
inventorySchema.statics.getStockSummary = function() {
  return this.aggregate([
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        totalStock: { $sum: "$currentStock" },
        totalReserved: { $sum: "$reservedStock" },
        totalAvailable: { $sum: "$availableStock" },
        lowStockCount: {
          $sum: {
            $cond: ["$alerts.lowStock", 1, 0]
          }
        },
        outOfStockCount: {
          $sum: {
            $cond: ["$alerts.outOfStock", 1, 0]
          }
        },
        overStockCount: {
          $sum: {
            $cond: ["$alerts.overStock", 1, 0]
          }
        }
      }
    }
  ]);
};

const Inventory = mongoose.model("Inventory", inventorySchema);
module.exports = Inventory;
