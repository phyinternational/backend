const router = require("express").Router();
const productVariationController = require("../controllers/product_varient.controller");
const { requireAdminLogin } = require("../middlewares/requireLogin");
const { addproductVariantSchema } = require("../validation/product-validation");
const validate = require("../validation/validate");
const upload = require("../middlewares/Multer");

router.post(
  "/product-variant/add",
  validate(addproductVariantSchema),
  productVariationController.addProductVariation
);

router.put(
  "/product-variant/update/:id",
  validate(addproductVariantSchema),
  productVariationController.updateProductVariation
);

router.delete(
  "/product-variant/delete/:id",
  productVariationController.deleteProductVariation
);

router.get(
  "/product-variant/:id/all",
  productVariationController.getAllProductVariation
);

router.get(
  "/product-variant/:id",
  productVariationController.getProductVariation
);

router.put(
  "/product/image/:productId/:colorId",
  requireAdminLogin,
  upload.array("images", 5), // Accept up to 5 images
  productVariationController.addProductImage
);

router.get("/product/image/:productId",
  productVariationController.getAllProductImages
);

router.get("/product/image/:productId/:colorId",
  productVariationController.getProductImages
);






module.exports = router;
