const mongoose = require("mongoose");

const silverPriceSchema = new mongoose.Schema({
  pricePerGram: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    default: "INR",
    enum: ["INR", "USD", "EUR"]
  },
  source: {
    type: String,
    required: true,
    default: "metalpriceapi"
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries
silverPriceSchema.index({ lastUpdated: -1 });
silverPriceSchema.index({ isActive: 1 });

const SilverPrice = mongoose.model("SilverPrice", silverPriceSchema);
module.exports = SilverPrice;
