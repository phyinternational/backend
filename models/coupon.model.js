const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    couponCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true, // For faster searches
    },
    couponAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    couponType: {
      type: String,
      required: true,
      enum: ["INR", "PERCENTAGE"],
      default: "INR",
    },
    couponQuantity: {
      type: Number,
      required: true,
      min: 1,
    },
    usedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    minCartAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    maxDiscountAmount: {
      type: Number,
      min: 0,
      default: null, // For percentage coupons, limit max discount
    },
    expiryDate: {
      type: Date,
      required: true,
      index: true, // For expiry queries
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    usagePerUser: {
      type: Number,
      default: 1, // How many times one user can use this coupon
      min: 1,
    },
    applicableCategories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductCategory"
    }], // Empty array means applicable to all
    excludeCategories: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductCategory"
    }],
    description: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    }
  },
  { timestamps: true }
);

// Virtual for remaining quantity
couponSchema.virtual('remainingQuantity').get(function() {
  return this.couponQuantity - this.usedQuantity;
});

// Virtual for usage percentage
couponSchema.virtual('usagePercentage').get(function() {
  return ((this.usedQuantity / this.couponQuantity) * 100).toFixed(2);
});

// Method to check if coupon is valid
couponSchema.methods.isValidCoupon = function(cartAmount = 0) {
  const now = new Date();
  return (
    this.isActive &&
    this.expiryDate > now &&
    this.usedQuantity < this.couponQuantity &&
    cartAmount >= this.minCartAmount
  );
};

// Method to calculate discount
couponSchema.methods.calculateDiscount = function(cartAmount) {
  if (!this.isValidCoupon(cartAmount)) return 0;
  
  let discount = 0;
  if (this.couponType === 'INR') {
    discount = this.couponAmount;
  } else if (this.couponType === 'PERCENTAGE') {
    discount = (cartAmount * this.couponAmount) / 100;
    // Apply max discount limit if set
    if (this.maxDiscountAmount && discount > this.maxDiscountAmount) {
      discount = this.maxDiscountAmount;
    }
  }
  
  // Ensure discount doesn't exceed cart amount
  return Math.min(discount, cartAmount);
};

// Pre-save middleware to auto-uppercase coupon code
couponSchema.pre('save', function(next) {
  if (this.couponCode) {
    this.couponCode = this.couponCode.toUpperCase().trim();
  }
  next();
});

const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = Coupon;
