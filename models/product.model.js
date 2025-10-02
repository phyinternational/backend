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
  brand: { type: mongoose.Schema.Types.ObjectId, ref: "Brand" },

});

// Create the model
const Product = mongoose.model("Product", productSchema);

module.exports = Product;
