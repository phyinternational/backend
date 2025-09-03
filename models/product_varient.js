const mongoose = require("mongoose");

const productVariantSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  size: { type: String, required: true },
  price: { type: Number, required: true },
  isActive: { type: Boolean, default: false },
  salePrice: { type: Number },
  stock: { type: Number, required: true },
  color: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product_Color",
  },
});

const ProductVariant = mongoose.model("ProductVarient", productVariantSchema);
module.exports = ProductVariant;
