const express = require("express");
const { requireAdminLogin } = require("../middlewares/requireLogin");
const trendProductController = require("../controllers/site_trending_product.controller");
const upload = require("../middlewares/Multer");
const router = express.Router();

router.post(
  "/admin/trending_product/add",
  // requireAdminLogin,
  upload.fields([{ name: "image", maxCount: 5 }]),

  trendProductController.addTrendingProduct_post
);
router.get(
  "/trending_product/all",
  trendProductController.getAllTrendingProduct_get
);

module.exports = router;
