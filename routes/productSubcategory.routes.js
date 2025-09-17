const express = require("express");
const router = express.Router();
const { requireAdminLogin } = require("../middlewares/requireLogin");
const {
  validateAddSubcategory,
  validateUpdateSubcategory,
  validateSortOrder,
  validateQuery
} = require("../validation/subcategory.validation");
const {
  test,
  addSubCategory,
  getAllSubCategory,
  getASubCategory,
  updateSubCategory,
  deleteSubCategory,
  getSubcategoriesByParent,
  getSubcategoryProducts,
  updateSortOrder,
  toggleActiveStatus,
} = require("../controllers/subcategory.controller");

// Test endpoint - Public
router.get("/test", test);

// Public routes
router.get("/getAll", validateQuery, getAllSubCategory);
router.get("/get/:id", getASubCategory);
router.get("/parent/:parentId", getSubcategoriesByParent);
router.get("/:id/products", validateQuery, getSubcategoryProducts);

// Admin-only routes
router.post("/add", requireAdminLogin, validateAddSubcategory, addSubCategory);
router.put("/update/:id", requireAdminLogin, validateUpdateSubcategory, updateSubCategory);
router.delete("/delete/:id", requireAdminLogin, deleteSubCategory);
router.patch("/sort-order", requireAdminLogin, validateSortOrder, updateSortOrder);
router.patch("/toggle-status/:id", requireAdminLogin, toggleActiveStatus);

module.exports = router;