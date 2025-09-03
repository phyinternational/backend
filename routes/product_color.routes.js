const express = require("express");
const { requireAdminLogin } = require("../middlewares/requireLogin");
const productColorController = require("../controllers/product_color.controller");
const router = express.Router();

router.post(
  "/product/color/add",
  requireAdminLogin,
  productColorController.addColor_post
);
router.post(
  "/product/color/update/:id",
  requireAdminLogin,
  productColorController.updateColor_post
);
router.get("/product/color/all", productColorController.allColor_get);

router.get("/product/color/:id", productColorController.singleColor_get);

router.delete(
  "/product/color/:id",
  requireAdminLogin,
  productColorController.deleteColor
);

module.exports = router;
