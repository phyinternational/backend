const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { successRes, errorRes, internalServerError } = require("../utility");
const catchAsync = require("../utility/catch-async");

// Create Stripe payment intent
module.exports.createStripePaymentIntent = catchAsync(async (req, res) => {
  try {
    const { amount, currency = 'inr', orderId, customerInfo } = req.body;

    if (!amount || amount <= 0) {
      return errorRes(res, 400, "Valid amount is required");
    }

    // Create customer if not exists
    let customer = null;
    if (customerInfo && customerInfo.email) {
      try {
        // Check if customer already exists
        const existingCustomers = await stripe.customers.list({
          email: customerInfo.email,
          limit: 1
        });

        if (existingCustomers.data.length > 0) {
          customer = existingCustomers.data[0];
        } else {
          // Create new customer
          customer = await stripe.customers.create({
            email: customerInfo.email,
            name: customerInfo.name,
            phone: customerInfo.phone,
            metadata: {
              orderId: orderId || '',
              userId: req.user?._id?.toString() || 'guest'
            }
          });
        }
      } catch (error) {
        console.warn("Error creating Stripe customer:", error.message);
      }
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to paise/cents
      currency: currency.toLowerCase(),
      customer: customer?.id,
      metadata: {
        orderId: orderId || '',
        userId: req.user?._id?.toString() || 'guest',
        source: 'jewelry_store'
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    successRes(res, {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      customerId: customer?.id,
      message: "Payment intent created successfully"
    });

  } catch (error) {
    console.error("Error creating Stripe payment intent:", error);
    internalServerError(res, "Error creating payment intent");
  }
});

// Confirm Stripe payment
module.exports.confirmStripePayment = catchAsync(async (req, res) => {
  try {
    const { paymentIntentId, paymentMethodId } = req.body;

    if (!paymentIntentId) {
      return errorRes(res, 400, "Payment intent ID is required");
    }

    // Retrieve payment intent
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (!paymentIntent) {
      return errorRes(res, 404, "Payment intent not found");
    }

    // Confirm payment if needed
    let confirmedPayment = paymentIntent;
    if (paymentIntent.status === 'requires_confirmation') {
      confirmedPayment = await stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId
      });
    }

    const paymentStatus = {
      'succeeded': 'COMPLETED',
      'requires_payment_method': 'PENDING',
      'requires_confirmation': 'PENDING',
      'requires_action': 'PENDING',
      'processing': 'PENDING',
      'canceled': 'FAILED',
      'requires_capture': 'PENDING'
    };

    successRes(res, {
      payment: {
        id: confirmedPayment.id,
        status: paymentStatus[confirmedPayment.status] || 'PENDING',
        amount: confirmedPayment.amount / 100,
        currency: confirmedPayment.currency,
        clientSecret: confirmedPayment.client_secret
      },
      message: "Payment status retrieved successfully"
    });

  } catch (error) {
    console.error("Error confirming Stripe payment:", error);
    
    if (error.type === 'StripeCardError') {
      return errorRes(res, 400, error.message);
    }
    
    internalServerError(res, "Error processing payment");
  }
});

// Handle Stripe webhooks
module.exports.handleStripeWebhook = catchAsync(async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return errorRes(res, 400, 'Webhook signature verification failed');
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object);
        break;
      case 'customer.created':
        console.log('New customer created:', event.data.object.id);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });

  } catch (error) {
    console.error("Error handling Stripe webhook:", error);
    internalServerError(res, "Error processing webhook");
  }
});

// Handle successful payment
async function handlePaymentSuccess(paymentIntent) {
  try {
    const orderId = paymentIntent.metadata.orderId;
    const userId = paymentIntent.metadata.userId;

    if (!orderId) {
      console.warn('No order ID found in payment intent metadata');
      return;
    }

    // Update order status
    if (userId === 'guest') {
      // Handle guest order
      const GuestOrder = require("../models/guest-order.model");
      await GuestOrder.findByIdAndUpdate(orderId, {
        'paymentInfo.status': 'COMPLETED',
        'paymentInfo.transactionId': paymentIntent.id,
        'paymentInfo.gateway': 'stripe',
        'paymentInfo.paidAt': new Date(),
        'orderStatus': 'CONFIRMED'
      });
    } else {
      // Handle user order
      const { User_Order } = require("../models/order.model");
      await User_Order.findByIdAndUpdate(orderId, {
        payment_status: 'COMPLETE',
        stripe_paymentId: paymentIntent.id,
        order_status: 'CONFIRMED'
      });

      // Award loyalty points
      const loyaltyController = require("./loyalty.controller");
      const amount = paymentIntent.amount / 100; // Convert from paise to rupees
      await loyaltyController.awardPointsForOrder(userId, amount, orderId);
    }

    console.log(`Payment successful for order ${orderId}: ${paymentIntent.id}`);

  } catch (error) {
    console.error('Error handling payment success:', error);
  }
}

// Handle failed payment
async function handlePaymentFailure(paymentIntent) {
  try {
    const orderId = paymentIntent.metadata.orderId;
    const userId = paymentIntent.metadata.userId;

    if (!orderId) {
      console.warn('No order ID found in payment intent metadata');
      return;
    }

    // Update order status
    if (userId === 'guest') {
      const GuestOrder = require("../models/guest-order.model");
      await GuestOrder.findByIdAndUpdate(orderId, {
        'paymentInfo.status': 'FAILED',
        'paymentInfo.transactionId': paymentIntent.id,
        'paymentInfo.gateway': 'stripe'
      });
    } else {
      const { User_Order } = require("../models/order.model");
      await User_Order.findByIdAndUpdate(orderId, {
        payment_status: 'FAILED',
        stripe_paymentId: paymentIntent.id
      });
    }

    console.log(`Payment failed for order ${orderId}: ${paymentIntent.id}`);

  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

// Get payment methods for customer
module.exports.getCustomerPaymentMethods = catchAsync(async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!customerId) {
      return errorRes(res, 400, "Customer ID is required");
    }

    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });

    successRes(res, {
      paymentMethods: paymentMethods.data.map(pm => ({
        id: pm.id,
        type: pm.type,
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year
        } : null,
        created: pm.created
      })),
      message: "Payment methods retrieved successfully"
    });

  } catch (error) {
    console.error("Error getting payment methods:", error);
    internalServerError(res, "Error retrieving payment methods");
  }
});

// Save payment method for future use
module.exports.savePaymentMethod = catchAsync(async (req, res) => {
  try {
    const { paymentMethodId, customerId } = req.body;

    if (!paymentMethodId || !customerId) {
      return errorRes(res, 400, "Payment method ID and customer ID are required");
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    successRes(res, {
      message: "Payment method saved successfully"
    });

  } catch (error) {
    console.error("Error saving payment method:", error);
    internalServerError(res, "Error saving payment method");
  }
});

// Delete saved payment method
module.exports.deletePaymentMethod = catchAsync(async (req, res) => {
  try {
    const { paymentMethodId } = req.params;

    if (!paymentMethodId) {
      return errorRes(res, 400, "Payment method ID is required");
    }

    await stripe.paymentMethods.detach(paymentMethodId);

    successRes(res, {
      message: "Payment method deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting payment method:", error);
    internalServerError(res, "Error deleting payment method");
  }
});
