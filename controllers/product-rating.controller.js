const ProductRating = require("../models/product-rating.model");
const catchAsync = require("../utility/catch-async");
const { buildPaginatedSortedFilteredQuery } = require("../utility/mogoose");

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
