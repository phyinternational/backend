const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;

const pointsTransactionSchema = new mongoose.Schema({
  user: {
    type: ObjectId,
    ref: "User",
    required: true
  },
  type: {
    type: String,
    enum: ["EARNED", "REDEEMED", "EXPIRED", "REFUNDED"],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true
  },
  orderId: {
    type: ObjectId,
    ref: "User_Order",
    default: null
  },
  guestOrderId: {
    type: ObjectId,
    ref: "GuestOrder",
    default: null
  },
  balanceAfter: {
    type: Number,
    required: true
  },
  expiryDate: {
    type: Date,
    default: null // Points earned have expiry, redeemed points don't
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for performance
pointsTransactionSchema.index({ user: 1, createdAt: -1 });
pointsTransactionSchema.index({ type: 1 });
pointsTransactionSchema.index({ expiryDate: 1 });
pointsTransactionSchema.index({ orderId: 1 });

// Static method to calculate points for purchase
pointsTransactionSchema.statics.calculatePurchasePoints = function(amount) {
  // ₹1 spent = 1 point
  return Math.floor(amount);
};

// Static method to calculate referral points
pointsTransactionSchema.statics.calculateReferralPoints = function(referredUserSpent) {
  // 5% of referred user's first purchase as points
  return Math.floor(referredUserSpent * 0.05);
};

const PointsTransaction = mongoose.model("PointsTransaction", pointsTransactionSchema);
module.exports = PointsTransaction;
