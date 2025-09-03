const express = require("express");
const router = express.Router();
const inventoryController = require("../controllers/inventory.controller");
const { requireAdminLogin } = require("../middlewares/requireLogin");
const { validateObjectId, validatePagination } = require("../middlewares/validation");

// Admin routes for inventory management
router.get("/admin/inventory/summary", 
  requireAdminLogin, 
  inventoryController.getInventorySummary
);

router.get("/admin/inventory/all", 
  requireAdminLogin, 
  validatePagination,
  inventoryController.getAllInventory
);

router.get("/admin/inventory/low-stock", 
  requireAdminLogin, 
  inventoryController.getLowStockItems
);

router.put("/admin/inventory/:inventoryId/stock", 
  requireAdminLogin, 
  validateObjectId('inventoryId'),
  inventoryController.updateStock
);

router.put("/admin/inventory/bulk-reorder-points", 
  requireAdminLogin, 
  inventoryController.bulkUpdateReorderPoints
);

router.get("/admin/inventory/:inventoryId/movements", 
  requireAdminLogin, 
  validateObjectId('inventoryId'),
  validatePagination,
  inventoryController.getInventoryMovements
);

router.post("/admin/inventory", 
  requireAdminLogin, 
  inventoryController.createOrUpdateInventory
);

router.get("/admin/inventory/report", 
  requireAdminLogin, 
  inventoryController.generateStockReport
);

module.exports = router;
