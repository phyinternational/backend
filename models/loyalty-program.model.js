const mongoose = require("mongoose");

const loyaltyProgramSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    default: "Silver Rewards"
  },
  pointsPerRupee: {
    type: Number,
    default: 1, // 1 point per ₹1 spent
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  tiers: [{
    name: {
      type: String,
      required: true // Bronze, Silver, Gold, Platinum
    },
    minPoints: {
      type: Number,
      required: true
    },
    benefits: {
      discountPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
      },
      freeShipping: {
        type: Boolean,
        default: false
      },
      earlyAccess: {
        type: Boolean,
        default: false
      },
      birthdayBonus: {
        type: Number,
        default: 0
      }
    }
  }],
  redemptionRules: {
    minPointsToRedeem: {
      type: Number,
      default: 100
    },
    pointsToRupeeRatio: {
      type: Number,
      default: 10 // 10 points = ₹1
    },
    maxRedemptionPercentage: {
      type: Number,
      default: 50 // Max 50% of order value can be paid with points
    }
  }
}, {
  timestamps: true
});

const LoyaltyProgram = mongoose.model("LoyaltyProgram", loyaltyProgramSchema);
module.exports = LoyaltyProgram;
