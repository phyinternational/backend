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
  let { productId, varientId } = req.body;

  // Clean up empty varientId
  if (varientId === "" || varientId === null) {
    varientId = undefined;
  }

  if (!productId) {
    return res.status(400).json({
      status: "fail",
      message: "productId is required",
    });
  }

  // Check if item already exists in wishlist
  const existingWishlistItem = await Wishlist.findOne({
    user: req.user.id,
    product: productId,
    variant: varientId || { $exists: false }
  });

  if (existingWishlistItem) {
    return res.status(400).json({
      status: "fail",
      message: "Item already exists in wishlist",
    });
  }

  const wishlistData = {
    user: req.user.id,
    product: productId,
  };

  // Only add variant if it's provided
  if (varientId) {
    wishlistData.variant = varientId;
  }

  const wishlist = await Wishlist.create(wishlistData);

  res.status(200).json({
    status: "success",
    data: wishlist,
  });
});


module.exports.removeFromWishlist = catchAsync(async (req, res) => {
  const { productId } = req.params;
  const { varientId } = req.query; // Allow variant to be passed as query param
  
  let query = {
    user: req.user.id,
    product: productId,
  };
  
  // If varientId is provided, include it in the query
  if (varientId && varientId !== "") {
    query.variant = varientId;
  } else {
    // If no varientId provided, match items without variants
    query.variant = { $exists: false };
  }

  const wishlist = await Wishlist.findOneAndDelete(query);

  if (!wishlist) {
    return res.status(404).json({
      status: "fail",
      message: "Item not found in wishlist",
    });
  }

  res.status(200).json({
    status: "success",
    data: wishlist,
  });
});
