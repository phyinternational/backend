const mongoose = require("mongoose");
const User_Cart = mongoose.model("User_Cart");
const User_WishlistDB = require("../models/wishlist.Model");
const Product = mongoose.model("Product");
const catchAsync = require("../utility/catch-async");
const ErrorHandler = require("../utility/error-handler");
const {
  errorRes,
  internalServerError,
  successRes,
} = require("../utility/index");

module.exports.getCartDetails_get = catchAsync(async (req, res) => {
  try {
    console.log(req.user.id);
    const cart = await User_Cart.findOne({ userId: req.user.id }).populate({
      path: "products.productId products.varientId",
    });

    res.status(200).json({
      status: "success",
      data: cart,
    });
  } catch (err) {
    console.error('getCartDetails_get error:', err);
    return internalServerError(res, err);
  }
});

module.exports.addProduct = catchAsync(async (req, res) => {
  try {
    let { productId, varientId, quantity } = req.body;

    // Clean up empty varientId
    if (varientId === "" || varientId === null) {
      varientId = undefined;
    }

    const cart = await User_Cart.findOne({ userId: req.user.id });
    if (!cart) {
      const newCart = new User_Cart({
        userId: req.user.id,
        products: [{ productId, varientId, quantity }],
      });
      await newCart.save();

      // Populate product details for consistent response
      const populatedCart = await User_Cart.findById(newCart._id)
        .populate("products.productId products.varientId");

      return successRes(res, { cart: populatedCart });
    }

    // Check if product already exists in cart
    const productIndex = cart.products.findIndex(
      (p) => p.productId.toString() === productId &&
             ((p.varientId && varientId && p.varientId.toString() === varientId.toString()) ||
              (!p.varientId && !varientId))
    );

    if (productIndex !== -1) {
      // If product exists, set quantity to the provided value (not increment)
      cart.products[productIndex].quantity = quantity;
    } else {
      // Add new product
      cart.products.push({ productId, varientId, quantity });
    }

    await cart.save();

    // Populate product details for consistent response
    const populatedCart = await User_Cart.findById(cart._id)
      .populate("products.productId products.varientId");

    successRes(res, { cart: populatedCart });
  } catch (err) {
    console.error('addProduct error:', err);
    return internalServerError(res, err);
  }
});

module.exports.updateProduct = catchAsync(async (req, res) => {
  try {
    let { productId, varientId, quantity } = req.body;

    // Clean up empty varientId
    if (varientId === "" || varientId === null) {
      varientId = undefined;
    }

    const cart = await User_Cart.findOne({ userId: req.user.id });
    if (!cart) return errorRes(res, 400, "Cart not found.");
    const productIndex = cart.products.findIndex(
      (p) => p.productId == productId && p.varientId == varientId
    );
    if (productIndex === -1) return errorRes(res, 400, "Product does not exist in cart.");
    cart.products[productIndex].quantity = quantity;
    await cart.save();
    successRes(res, { cart });
  } catch (err) {
    console.error('updateProduct error:', err);
    return internalServerError(res, err);
  }
});

module.exports.getCartDetailsByUser = catchAsync(async (req, res) => {
  try {
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
  } catch (err) {
    console.error('getCartDetailsByUser error:', err);
    return internalServerError(res, err);
  }
});

module.exports.upsertCart = catchAsync(async (req, res, next) => {
  try {
    const { products } = req.body;

    // Clean up empty varientId values
    const cleanedProducts = products.map(product => {
      const cleanProduct = { ...product };
      if (cleanProduct.varientId === "" || cleanProduct.varientId === null) {
        delete cleanProduct.varientId;
      }
      return cleanProduct;
    });

    const promises = cleanedProducts.map((product) => {
      return Product.findById(product.productId);
    });

    const validateProducts = await Promise.all(promises);

    let hasNullValue = false;
    let invalidProductIds = [];

    validateProducts.forEach((val, index) => {
      if (!val) {
        hasNullValue = true;
        invalidProductIds.push(cleanedProducts[index].productId);
      }
    });

    if (hasNullValue) {
      return errorRes(res, 404, `The following products are not available: ${invalidProductIds.join(', ')}. Please remove them from your cart and try again.`);
    }
    const cart = await User_Cart.findOneAndUpdate(
      { userId: req.user._id },
      { $set: { products: cleanedProducts } },
      { upsert: true, new: true }
    );

    res.status(200).json({
      status: "success",
      data: cart,
    });
  } catch (err) {
    console.error('upsertCart error:', err);
    return internalServerError(res, err);
  }
});

module.exports.removeFromCart = catchAsync(async (req, res) => {
  try {
    let { productId, varientId } = req.body;

    // Clean up empty varientId
    if (varientId === "" || varientId === null) {
      varientId = undefined;
    }

    const cart = await User_Cart.findOne({ userId: req.user.id });
    if (!cart) return errorRes(res, 400, "Cart not found.");
    const productIndex = cart.products.findIndex(
      (p) => p.productId == productId && p.varientId == varientId
    );
    if (productIndex === -1) return errorRes(res, 400, "Product does not exist in cart.");
    cart.products.splice(productIndex, 1);
    await cart.save();
    successRes(res, { cart });
  } catch (err) {
    console.error('removeFromCart error:', err);
    return internalServerError(res, err);
  }
});
