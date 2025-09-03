const mongoose = require("mongoose");

const userLoyaltySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  totalPoints: {
    type: Number,
    default: 0,
    min: 0
  },
  availablePoints: {
    type: Number,
    default: 0,
    min: 0
  },
  lifetimeSpent: {
    type: Number,
    default: 0,
    min: 0
  },
  currentTier: {
    name: {
      type: String,
      default: "Bronze"
    },
    minPoints: {
      type: Number,
      default: 0
    },
    benefits: {
      discountPercentage: Number,
      freeShipping: Boolean,
      earlyAccess: Boolean,
      birthdayBonus: Number
    }
  },
  pointsHistory: [{
    type: {
      type: String,
      enum: ["EARNED", "REDEEMED", "EXPIRED", "BONUS", "REFUND"],
      required: true
    },
    points: {
      type: Number,
      required: true
    },
    description: String,
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User_Order"
    },
    guestOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GuestOrder"
    },
    expiryDate: Date,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  statistics: {
    totalEarned: {
      type: Number,
      default: 0
    },
    totalRedeemed: {
      type: Number,
      default: 0
    },
    totalExpired: {
      type: Number,
      default: 0
    },
    orderCount: {
      type: Number,
      default: 0
    },
    averageOrderValue: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Index for better performance
userLoyaltySchema.index({ user: 1 });
userLoyaltySchema.index({ totalPoints: -1 });
userLoyaltySchema.index({ "currentTier.name": 1 });

// Method to add points
userLoyaltySchema.methods.addPoints = function(points, type, description, orderId, guestOrderId) {
  this.totalPoints += points;
  this.availablePoints += points;
  this.statistics.totalEarned += points;
  
  // Set expiry date for earned points (1 year)
  const expiryDate = type === "EARNED" ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) : null;
  
  this.pointsHistory.push({
    type,
    points,
    description,
    orderId,
    guestOrderId,
    expiryDate
  });
  
  return this.save();
};

// Method to redeem points
userLoyaltySchema.methods.redeemPoints = function(points, description, orderId) {
  if (this.availablePoints < points) {
    throw new Error("Insufficient points");
  }
  
  this.availablePoints -= points;
  this.statistics.totalRedeemed += points;
  
  this.pointsHistory.push({
    type: "REDEEMED",
    points: -points,
    description,
    orderId
  });
  
  return this.save();
};

// Method to update tier
userLoyaltySchema.methods.updateTier = async function() {
  const LoyaltyProgram = require("./loyalty-program.model");
  const program = await LoyaltyProgram.findOne({ isActive: true });
  
  if (!program) return;
  
  // Find appropriate tier based on total points
  let newTier = program.tiers[0]; // Default to first tier
  
  for (const tier of program.tiers.sort((a, b) => b.minPoints - a.minPoints)) {
    if (this.totalPoints >= tier.minPoints) {
      newTier = tier;
      break;
    }
  }
  
  this.currentTier = {
    name: newTier.name,
    minPoints: newTier.minPoints,
    benefits: newTier.benefits
  };
  
  return this.save();
};

const UserLoyalty = mongoose.model("UserLoyalty", userLoyaltySchema);
module.exports = UserLoyalty;
