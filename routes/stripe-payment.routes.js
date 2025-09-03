const express = require("express");
const router = express.Router();
const stripeController = require("../controllers/stripe-payment.controller");
const { requireUserLogin } = require("../middlewares/requireLogin");

// Stripe payment routes
router.post("/stripe/create-payment-intent", stripeController.createStripePaymentIntent);
router.post("/stripe/confirm-payment", stripeController.confirmStripePayment);

// Customer payment methods (requires login)
router.get("/stripe/customer/:customerId/payment-methods", 
  requireUserLogin, 
  stripeController.getCustomerPaymentMethods
);

router.post("/stripe/save-payment-method", 
  requireUserLogin, 
  stripeController.savePaymentMethod
);

router.delete("/stripe/payment-method/:paymentMethodId", 
  requireUserLogin, 
  stripeController.deletePaymentMethod
);

// Webhook endpoint (no authentication required)
router.post("/stripe/webhook", 
  express.raw({type: 'application/json'}), 
  stripeController.handleStripeWebhook
);

module.exports = router;
