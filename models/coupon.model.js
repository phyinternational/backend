const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    couponCode: {
      type: String,
      required: true,
      unique: true,
    },
    couponAmount: {
      type: Number,
      required: true,
      min: 0, // Assuming coupon amount cannot be negative
    },
    couponType: {
      type: String,
      required: true,
      enum: ["INR", "PERCENTAGE"], // Assuming two types: INR for fixed amount, PERCENTAGE for percent off
      default: "INR",
    },
    couponQuantity: {
      type: Number,
      required: true,
      min: 1, // Assuming at least one use is required
    },
    minCartAmount: {
      type: Number,
      required: true,
      min: 0, // Assuming minimum cart amount cannot be negative
    },
    expiryDate: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = Coupon;
