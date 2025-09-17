const express = require("express");
const {
  allProductRating_get,
  addProductRating,
  getProductRatings_get,
} = require("../controllers/product-rating.controller");
const { requireUserLogin } = require("../middlewares/requireLogin");
const productRatingValidation = require("../validation/product-rating");
const validate = require("../validation/validate");
const router = express.Router();

router.get("/product/rating/all", allProductRating_get);

router.post(
  "/product/rating",
  requireUserLogin,
  validate(productRatingValidation),
  addProductRating
);

router.get("/product/:id/rating", getProductRatings_get);

module.exports = router;
