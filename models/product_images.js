const mongoose = require("mongoose");

const productImageSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  imageUrls: [{ type: String, required: true }],
  color: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product_Color",
  },
});

const ProductImage = mongoose.model("ProductImage", productImageSchema);

module.exports = ProductImage;
