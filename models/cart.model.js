const mongoose = require("mongoose");

const ItemSchema = mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, "product Id is required"],
    ref: "Product",
    unique: true,
  },
  quantity: {
    type: Number,
    required: [true, "quantity is required"],
  },
  varientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, "product Id is required"],
    ref: "ProductVarient",
  },
});

const cartSchema = mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Company",
    required: [true, "userId is required"],
  },
  products: [ItemSchema],
});

const Cart = mongoose.model("User_Cart", cartSchema);

module.exports = Cart;
