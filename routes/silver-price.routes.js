const express = require("express");
const router = express.Router();
const silverPriceService = require("../services/silver-price.service");
const { requireAdminLogin } = require("../middlewares/requireLogin");
const { successRes, errorRes, internalServerError } = require("../utility");

// Admin route to manually update silver price
router.post("/admin/silver-price/update", requireAdminLogin, async (req, res) => {
  try {
    const priceData = await silverPriceService.fetchCurrentSilverPrice();
    const saved = await silverPriceService.saveSilverPrice(priceData);
    return successRes(res, {
      price: saved,
      message: "Silver price updated successfully"
    });
  } catch (error) {
    console.error("Error updating silver price:", error);
    return internalServerError(res, "Failed to update silver price");
  }
});

module.exports = router;
