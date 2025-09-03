const express = require("express");
const router = express.Router();
const loyaltyController = require("../controllers/loyalty.controller");
const { requireUserLogin, requireAdminLogin } = require("../middlewares/requireLogin");

// User routes
router.get("/user/loyalty", requireUserLogin, loyaltyController.getUserLoyalty);
router.get("/user/loyalty/history", requireUserLogin, loyaltyController.getPointsHistory);
router.post("/user/loyalty/calculate-points", requireUserLogin, loyaltyController.calculatePoints);
router.post("/user/loyalty/redeem", requireUserLogin, loyaltyController.redeemPoints);

// Public routes
router.get("/loyalty/program", loyaltyController.getLoyaltyProgram);

// Admin routes
router.put("/admin/loyalty/program", requireAdminLogin, loyaltyController.updateLoyaltyProgram);
router.get("/admin/loyalty/users", requireAdminLogin, loyaltyController.getAllUsersLoyalty);

module.exports = router;
