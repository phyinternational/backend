const express = require("express");
const {
  allProductRating_get,
  addProductRating,
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

router.get("/product/:id/rating", (req, res) => {
  res.status(200).json({ message: "Product Rating Single" });
});

module.exports = router;
