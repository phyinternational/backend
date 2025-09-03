const express = require("express");
const { requireAdminLogin, addUser } = require("../middlewares/requireLogin");
const productController = require("../controllers/product.controller");
const router = express.Router();
const upload = require("../middlewares/Multer");
router.get("/product/all", addUser,productController.allProducts_get);
router.get("/product/random/:limit", productController.randomProducts_get);
router.post("/product/filter", productController.filterProducts_post);
router.post(
  "/admin/product/add",
  requireAdminLogin,
  productController.addProduct_post
);
router.post(
  "/admin/product/bulk",
  requireAdminLogin,
  productController.uploadProductBulk
);


router.get("/product/search/paginated", productController.paginatedSearch);

router.put(
  "/product/update-availability/:variantId",
  productController.availabilityUpdate_put
);
router.get("/product/searchproduct", productController.searchProduct);
router.get("/product/search/query", productController.prodct_search_get);

router.get("/product/get/featured", productController.getFeaturedProducts);

router.get("/product/:productId",addUser, productController.getParticularProduct_get);

router.put(
  "/admin/product/:productId/edit",
  requireAdminLogin,
  productController.editProduct_post
);

router.delete(
  "/admin/product/:productId/delete",
  requireAdminLogin,
  productController.deleteProduct_delete
);

router.put(
  "/product/update/featured/:productId",
  productController.updateFeatured
);

// New jewelry-specific routes
router.put("/admin/product/:productId/update-pricing", 
  requireAdminLogin, 
  productController.updateProductPricing
);

router.post("/admin/product/bulk-update-pricing", 
  requireAdminLogin, 
  productController.bulkUpdatePricing
);

module.exports = router;
