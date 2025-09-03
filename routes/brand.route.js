const express = require("express");
const brandController = require("../controllers/brand.controller");
const { requireAdminLogin } = require("../middlewares/requireLogin");
const validate = require("../validation/validate");
const { createBrandSchema, editBrandSchema } = require("../validation/brand");
const router = express.Router();

// Route to add a new brand (accessible only to admin)
router.post(
  "/admin/brand/add",
  validate(createBrandSchema),
  requireAdminLogin,
  brandController.addBrand
);

// Route to get all brands
router.get("/brand/all", brandController.getAllBrands);

// Route to delete a brand by its ID (accessible only to admin)
router.delete(
  "/admin/brand/:id/delete",
  requireAdminLogin,
  brandController.deleteBrand
);

// Route to edit a brand by its ID (accessible only to admin)
router.put(
  "/admin/brand/:id/edit",
  requireAdminLogin,
  validate(editBrandSchema),
  brandController.editBrand
);

// Route to get a brand by its ID
router.get("/brand/:id", brandController.getBrandById);

module.exports = router;
