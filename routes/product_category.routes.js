const express = require("express");
const router = express.Router();
const upload = require("../middlewares/Multer");
const categoryController = require("../controllers/product_category.controller");
const {
  requireAdminLogin,
  requireUserLogin,
} = require("../middlewares/requireLogin");

router.post(
  "/product/category/add",
  requireAdminLogin,
  categoryController.addProductCategory_post
);
router.post(
  "/product/category/subcategory/add",
  requireAdminLogin,
  categoryController.addSubCategory_post
);

router.get(
  "/product/category/subcategory/:parentId",
  categoryController.getSubCategory_get
);

router.get(
  "/product/category/products/:slug",
  categoryController.getCategoryProducts_get
);

router.delete(
  "/product/category/:categoryId/delete",
  requireAdminLogin,
  categoryController.deleteProductCategory_delete
);

router.delete(
  "/product/category/:categoryId/delete",
  requireAdminLogin,
  categoryController.deleteProductCategory_delete
);
router.put(
  "/product/category/:categoryId",
  categoryController.editCategory
);
router.get(
  "/product/category/single/:id",
  categoryController.getSingleCategory_get
);
router.get("/product/category/all", categoryController.allCategory_get);

module.exports = router;
