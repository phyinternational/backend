const mongoose = require("mongoose");
const User_Cart = mongoose.model("User_Cart");
const User_WishlistDB = require("../models/wishlist.Model");
const Product = mongoose.model("Product");
const catchAsync = require("../utility/catch-async");

const {
  errorRes,
  internalServerError,
  successRes,
} = require("../utility/index");

module.exports.getCartDetails_get = catchAsync(async (req, res) => {
  console.log(req.user.id);
  const cart = await User_Cart.findOne({ userId: req.user.id }).populate({
    path: "products.productId products.varientId",
  });

  res.status(200).json({
    status: "success",
    data: cart,
  });
});

module.exports.addProduct = catchAsync(async (req, res) => {
  const { productId, varientId, quantity } = req.body;
  const cart = await User_Cart.findOne({ userId: req.user.id });
  if (!cart) {
    const newCart = new User_Cart({
      userId: req.user.id,
      products: [{ productId, varientId, quantity }],
    });
    await newCart.save();
    return successRes(res, { cart: newCart });
  }
  const productIndex = cart.products.findIndex(
    (p) => p.productId == productId && p.varientId == varientId
  );
  if (productIndex !== -1)
    return errorRes(res, 400, "Product already exists in cart.");
  else cart.products.push({ productId, varientId, quantity });
  await cart.save();
  successRes(res, { cart });
});

module.exports.updateProduct = catchAsync(async (req, res) => {
  const { productId, varientId, quantity } = req.body;
  const cart = await User_Cart.findOne({ userId: req.user.id });
  if (!cart) return errorRes(res, 400, "Cart not found.");
  const productIndex = cart.products.findIndex(
    (p) => p.productId == productId && p.varientId == varientId
  );
  if (productIndex === -1)
    return errorRes(res, 400, "Product does not exist in cart.");
  cart.products[productIndex].quantity = quantity;
  await cart.save();
  successRes(res, { cart });
});

module.exports.getCartDetailsByUser = catchAsync(async (req, res) => {
  console.log(req.params.userId);
  const cart = await User_Cart.findOne({ userId: req.params.userId })
    .populate({
      path: "products.productId products.varientId",
    })
    .populate("products.varientId.");

  res.status(200).json({
    status: "success",
    data: cart,
  });
});

module.exports.upsertCart = catchAsync(async (req, res, next) => {
  const { products } = req.body;
  const promises = products.map((product) => {
    return Product.findById(product.productId);
  });

  const validateProducts = await Promise.all(promises);

  let hasNullValue = false;
  validateProducts.forEach((val) => {
    if (!val) {
      hasNullValue = true;
    }
  });

  if (hasNullValue) {
    return next(new ErrorHandler("one or more product does not exist", 404));
  }
  const cart = await User_Cart.findOneAndUpdate(
    { userId: req.user._id },
    { $set: { products } },
    { upsert: true, new: true }
  );

  res.status(200).json({
    status: "success",
    data: cart,
  });
});

module.exports.removeFromCart = catchAsync(async (req, res) => {
  const { productId, varientId } = req.body;
  const cart = await User_Cart.findOne({ userId: req.user.id });
  if (!cart) return errorRes(res, 400, "Cart not found.");
  const productIndex = cart.products.findIndex(
    (p) => p.productId == productId && p.varientId == varientId
  );
  if (productIndex === -1)
    return errorRes(res, 400, "Product does not exist in cart.");
  cart.products.splice(productIndex, 1);
  await cart.save();
  successRes(res, { cart });
});
