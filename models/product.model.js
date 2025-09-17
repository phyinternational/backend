const mongoose = require("mongoose");

const productSchema = new mongoose.Schema({
  productTitle: { type: String, required: true, minlength: 3 },
  productSlug: {
    type: String,
    required: true,
    minlength: 1,
    unique: true,
    index: true,
  },
  skuNo: { type: String, required: true, minlength: 1, unique: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: "ProductCategory" },
  color: { type: mongoose.Schema.Types.ObjectId, ref: "Product_Color" },
  regularPrice: { type: Number, required: true, default: 0 },
  salePrice: { type: Number, required: true, default: 0 },
  isActive: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false },
  productDescription: {
    type: String,
    required: true,
    minlength: 1,
    default: "NA",
  },
  careHandling: { type: String, required: true, minlength: 1, default: "NA" },
  gst: { type: Number, default: 18 }, // Updated default GST for jewelry
  productImageUrl: [{
    type: String,
    optional: true
  }],
  sizeChartUrl: { type: String },
  brand: { type: mongoose.Schema.Types.ObjectId, ref: "Brand" },
  
  // New jewelry-specific fields
  silverWeight: { 
    type: Number, 
    required: true,
    min: 0,
    default: 0
  },
  laborPercentage: { 
    type: Number, 
    default: 0,
    min: 0,
    max: 100
  },
  isDynamicPricing: {
    type: Boolean,
    default: true
  },
  staticPrice: {
    type: Number,
    default: 0
  },
  metalPurity: {
    type: String,
    enum: ['925', '999', '916', 'other'],
    default: '925'
  },
  gemstones: [{
    name: String,
    weight: Number,
    pricePerCarat: Number
  }],
  makingCharges: {
    type: Number,
    default: 0
  },
  priceBreakdown: {
    silverCost: Number,
    laborCost: Number,
    gemstoneCost: Number,
    makingCharges: Number,
    gstAmount: Number,
    totalPrice: Number,
    lastCalculated: Date
  },
});

// Create the model
const Product = mongoose.model("Product", productSchema);

module.exports = Product;
