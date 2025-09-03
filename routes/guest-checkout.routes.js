const express = require("express");
const router = express.Router();
const guestCheckoutController = require("../controllers/guest-checkout.controller");

// Guest checkout routes
router.post("/guest/order/place", guestCheckoutController.placeGuestOrder);
router.get("/guest/order/:orderId/:email", guestCheckoutController.getGuestOrder);
router.post("/guest/convert-to-user", guestCheckoutController.convertGuestToUser);

module.exports = router;
