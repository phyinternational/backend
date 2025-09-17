const ProductRating = require("../models/product-rating.model");
const catchAsync = require("../utility/catch-async");
const { buildPaginatedSortedFilteredQuery } = require("../utility/mogoose");
const mongoose = require("mongoose");
const { errorRes, successRes } = require("../utility");

module.exports.allProductRating_get = catchAsync(async (req, res) => {
  const filter = {};
  const productRating = await buildPaginatedSortedFilteredQuery(
    ProductRating.find(filter).populate("product").populate("user"),
    req,
    ProductRating
  );
  const data = {
    productRating: productRating,
    total: productRating.total,
    limit: productRating.limit,
    page: productRating.page,
    pages: productRating.pages,
  };
  res.status(200).json({ data });
});

module.exports.singleProductRating_get = catchAsync(async (req, res) => {
  const { id } = req.params;
  const productRating = await ProductRating.findById(id)
    .populate("category")
    .populate("product");
  res.status(200).json(productRating);
});

module.exports.addProductRating = catchAsync(async (req, res) => {
  const user = req.user._id;
  const { rating, reviewText, product } = req.body;
  const productRating = new ProductRating({
    user: user,
    rating,
    reviewText,
    product,
  });
  const savedProductRating = await productRating.save();
  res.status(201).json(savedProductRating);
});

// Get ratings for a specific product
module.exports.getProductRatings_get = catchAsync(async (req, res) => {
  const { id } = req.params;
  
  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorRes(res, 400, "Invalid product ID format");
  }

  const filter = { product: id };
  
  const productRatings = await buildPaginatedSortedFilteredQuery(
    ProductRating.find(filter)
      .populate("user", "name email")
      .populate("product", "displayName price")
      .sort({ date: -1 }), // Sort by newest first
    req,
    ProductRating
  );

  // Calculate rating statistics
  const allRatings = await ProductRating.find(filter);
  const totalRatings = allRatings.length;
  
  let avgRating = 0;
  let ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  
  if (totalRatings > 0) {
    const sumRatings = allRatings.reduce((sum, rating) => sum + rating.rating, 0);
    avgRating = Math.round((sumRatings / totalRatings) * 100) / 100; // Round to 2 decimal places
    
    // Count rating distribution
    allRatings.forEach(rating => {
      ratingDistribution[rating.rating]++;
    });
  }

  const data = {
    productRatings: productRatings,
    statistics: {
      totalRatings,
      averageRating: avgRating,
      ratingDistribution
    },
    pagination: {
      total: productRatings.total,
      limit: productRatings.limit,
      page: productRatings.page,
      pages: productRatings.pages,
    }
  };

  successRes(res, data);
});
