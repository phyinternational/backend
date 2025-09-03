const Wishlist = require("../models/wishlist.Model");
const catchAsync = require("../utility/catch-async");

module.exports.getWishlistByUser = catchAsync(async (req, res) => {
  const wishlist = await Wishlist.find({ user: req.user.id }).populate({
    path: "product variant",
  });

  res.status(200).json({
    status: "success",
    data: wishlist,
  });
});

module.exports.addtoWishlist = catchAsync(async (req, res) => {
  const { productId, varientId } = req.body;

  if (!productId || !varientId) {
    return res.status(400).json({
      status: "fail",
      message: "productId and varientId are required",
    });
  }

  const wishlist = await Wishlist.create({
    user: req.user.id,
    product: productId,
    variant: varientId,
  });

  res.status(200).json({
    status: "success",
    data: wishlist,
  });
});


module.exports.removeFromWishlist = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const wishlist = await Wishlist.findOneAndDelete({
    user: req.user.id,
    product: productId,
  });

  res.status(200).json({
    status: "success",
    data: wishlist,
  });
});
