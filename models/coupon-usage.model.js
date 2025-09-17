const mongoose = require("mongoose");

// Track individual coupon usage for analytics and user limits
const couponUsageSchema = new mongoose.Schema({
  couponId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Coupon",
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: false, // Allow guest usage
    index: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User_Order",
    required: false // Track when actually used in orders
  },
  discountAmount: {
    type: Number,
    required: true,
    min: 0
  },
  originalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  finalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  appliedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ["APPLIED", "USED", "REVERTED"],
    default: "APPLIED"
  },
  userIP: String,
  userAgent: String
}, { 
  timestamps: true 
});

// Compound index for efficient queries
couponUsageSchema.index({ couponId: 1, userId: 1 });
couponUsageSchema.index({ userId: 1, appliedAt: -1 });

const CouponUsage = mongoose.model("CouponUsage", couponUsageSchema);

module.exports = CouponUsage;