const express = require("express");
const router = express.Router();
const pricingController = require("../controllers/pricing.controller");
const { requireAdminLogin } = require("../middlewares/requireLogin");

// Public routes
router.get("/pricing/silver/current", pricingController.getCurrentSilverPrice);
router.post("/pricing/calculate", pricingController.calculateProductPrice);

// Admin routes
router.post("/admin/pricing/silver/update", 
  requireAdminLogin, 
  pricingController.forceUpdateSilverPrice
);

router.get("/admin/pricing/silver/history", 
  requireAdminLogin, 
  pricingController.getSilverPriceHistory
);

router.post("/admin/pricing/labor/settings", 
  requireAdminLogin, 
  pricingController.updateLaborSettings
);

router.get("/admin/pricing/labor/settings", 
  requireAdminLogin, 
  pricingController.getLaborSettings
);

module.exports = router;
