const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;

const loyaltyProgramSchema = new mongoose.Schema({
  user: {
    type: ObjectId,
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
  usedPoints: {
    type: Number,
    default: 0,
    min: 0
  },
  tier: {
    type: String,
    enum: ["BRONZE", "SILVER", "GOLD", "PLATINUM"],
    default: "BRONZE"
  },
  tierBenefits: {
    discountPercentage: { type: Number, default: 0 },
    freeShipping: { type: Boolean, default: false },
    earlyAccess: { type: Boolean, default: false },
    personalShopper: { type: Boolean, default: false }
  },
  lifetimeSpent: {
    type: Number,
    default: 0,
    min: 0
  },
  joinDate: {
    type: Date,
    default: Date.now
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  referralCode: {
    type: String,
    unique: true,
    sparse: true
  },
  referredBy: {
    type: ObjectId,
    ref: "User",
    default: null
  },
  referralStats: {
    totalReferrals: { type: Number, default: 0 },
    successfulReferrals: { type: Number, default: 0 },
    referralEarnings: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Indexes for performance
loyaltyProgramSchema.index({ user: 1 });
loyaltyProgramSchema.index({ tier: 1 });
loyaltyProgramSchema.index({ referralCode: 1 });
loyaltyProgramSchema.index({ totalPoints: -1 });

// Method to calculate tier based on lifetime spent
loyaltyProgramSchema.methods.calculateTier = function() {
  const spent = this.lifetimeSpent;
  
  if (spent >= 100000) { // ₹1,00,000+
    this.tier = "PLATINUM";
    this.tierBenefits = {
      discountPercentage: 15,
      freeShipping: true,
      earlyAccess: true,
      personalShopper: true
    };
  } else if (spent >= 50000) { // ₹50,000+
    this.tier = "GOLD";
    this.tierBenefits = {
      discountPercentage: 10,
      freeShipping: true,
      earlyAccess: true,
      personalShopper: false
    };
  } else if (spent >= 20000) { // ₹20,000+
    this.tier = "SILVER";
    this.tierBenefits = {
      discountPercentage: 5,
      freeShipping: true,
      earlyAccess: false,
      personalShopper: false
    };
  } else {
    this.tier = "BRONZE";
    this.tierBenefits = {
      discountPercentage: 0,
      freeShipping: false,
      earlyAccess: false,
      personalShopper: false
    };
  }
};

// Method to add points
loyaltyProgramSchema.methods.addPoints = function(points, reason) {
  this.totalPoints += points;
  this.availablePoints += points;
  this.lastActivity = new Date();
  
  // Log the transaction
  const PointsTransaction = require('./points-transaction.model');
  const transaction = new PointsTransaction({
    user: this.user,
    type: 'EARNED',
    amount: points,
    reason: reason,
    balanceAfter: this.availablePoints
  });
  
  return transaction.save();
};

// Method to redeem points
loyaltyProgramSchema.methods.redeemPoints = function(points, reason) {
  if (this.availablePoints < points) {
    throw new Error('Insufficient points');
  }
  
  this.availablePoints -= points;
  this.usedPoints += points;
  this.lastActivity = new Date();
  
  // Log the transaction
  const PointsTransaction = require('./points-transaction.model');
  const transaction = new PointsTransaction({
    user: this.user,
    type: 'REDEEMED',
    amount: points,
    reason: reason,
    balanceAfter: this.availablePoints
  });
  
  return transaction.save();
};

// Generate unique referral code
loyaltyProgramSchema.methods.generateReferralCode = function() {
  const shortid = require('shortid');
  this.referralCode = `REF${shortid.generate().toUpperCase()}`;
};

const LoyaltyProgram = mongoose.model("LoyaltyProgram", loyaltyProgramSchema);
module.exports = LoyaltyProgram;
