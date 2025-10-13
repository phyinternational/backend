const GuestOrder = require("../models/guest-order.model");
const Product = require("../models/product.model");
const { successRes, errorRes, internalServerError } = require("../utility");
const catchAsync = require("../utility/catch-async");
const crypto = require("crypto");

// Place guest order
module.exports.placeGuestOrder = catchAsync(async (req, res) => {
  // Debug: Log incoming payload
  console.log('--- Incoming Guest Order Payload ---');
  console.log(JSON.stringify(req.body, null, 2));
  try {
    const {
      guestInfo,
      products,
      shippingAddress,
      billingAddress,
      paymentMethod,
      couponCode
    } = req.body;

    // Validation
    if (!guestInfo || !guestInfo.email || !guestInfo.phoneNumber) {
      return errorRes(res, 400, "Guest information is required");
    }

    if (!products || products.length === 0) {
      return errorRes(res, 400, "Products are required");
    }

    if (!shippingAddress) {
      return errorRes(res, 400, "Shipping address is required");
    }

    // Validate and calculate product prices
    let orderSubtotal = 0;
    let totalGST = 0;
    const processedProducts = [];

  // Debug: Log processed products array as it's built

    for (const item of products) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return errorRes(res, 400, `Product not found: ${item.productId}`);
      }

      let itemPrice;
      let priceBreakdown = {};

      // Use static price for all products (dynamic pricing removed)
      itemPrice = product.staticPrice || product.salePrice || product.price || 0;
      const gstAmount = (product.gst / 100) * itemPrice;
      priceBreakdown = {
        basePrice: itemPrice,
        gstAmount: gstAmount,
        finalPrice: itemPrice + gstAmount,
      };

      const totalItemPrice = itemPrice * item.quantity;
      const itemGST = (priceBreakdown.gstAmount || 0) * item.quantity;

      processedProducts.push({
        product: product._id,
        quantity: item.quantity,
        price: itemPrice,
        variant: item.variantId || null,
        priceBreakdown: priceBreakdown
      });

      // Debug: Log each processed product
      console.log('Processed product:', {
        product: product._id,
        quantity: item.quantity,
        price: itemPrice,
        variant: item.variantId || null
      });

      orderSubtotal += totalItemPrice;
      totalGST += itemGST;
    }

    // Apply coupon if provided
    let discount = 0;
    let couponApplied = null;
    if (couponCode) {
      const Coupon = require("../models/coupon.model");
      const coupon = await Coupon.findOne({ 
        code: couponCode, 
        is_active: true 
      });
      
      if (coupon && orderSubtotal >= coupon.min_price) {
        discount = (coupon.discount_percent / 100) * orderSubtotal;
        couponApplied = coupon._id;
      }
    }

    const finalAmount = orderSubtotal - discount;

    // Create guest order
    // Debug: Log final guest order object before saving
    const guestOrderObj = {
      guestInfo,
      products: processedProducts,
      shippingAddress,
      billingAddress: billingAddress || { ...shippingAddress, sameAsShipping: true },
      orderTotal: {
        subtotal: orderSubtotal,
        gstAmount: totalGST,
        discount: discount,
        finalAmount: finalAmount
      },
      paymentInfo: {
        method: paymentMethod || "ONLINE",
        status: "PENDING"
      },
      couponApplied,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };
    console.log('--- GuestOrder object to be saved ---');
    console.log(JSON.stringify(guestOrderObj, null, 2));
    const guestOrder = new GuestOrder(guestOrderObj);


    const savedOrder = await guestOrder.save();

    // Generate conversion token for post-purchase account creation
    const conversionToken = crypto.randomBytes(32).toString('hex');
    savedOrder.conversionToken = conversionToken;
    savedOrder.conversionToken.expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await savedOrder.save();

    // Create Razorpay order (same as for logged-in user)
    const { razorpayInstance } = require('../utility');
    const amountInPaise = Math.round(finalAmount * 100);
    const rzpOptions = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `guest_rcpt_${savedOrder._id}`,
      notes: { guestOrderId: savedOrder._id.toString() }
    };
    let rzpOrder;
    try {
      rzpOrder = await new Promise((resolve, reject) => {
        razorpayInstance.orders.create(rzpOptions, (err, order) => {
          if (err) reject(err);
          else resolve(order);
        });
      });
    } catch (err) {
      return internalServerError(res, 'Failed to create Razorpay order');
    }

    // Send order confirmation email with account creation link (non-blocking)
    const emailService = require('../services/email.service');
    emailService.sendGuestOrderConfirmation(savedOrder).catch(err => console.error(err));

    successRes(res, {
      order: savedOrder,
      rzpOrder,
      conversionToken,
      message: "Guest order placed successfully"
    });

  } catch (error) {
    console.error("Error placing guest order:", error);
    internalServerError(res, "Error placing order");
  }
});

// Get guest order by email and order ID
module.exports.getGuestOrder = catchAsync(async (req, res) => {
  try {
    const { orderId, email } = req.params;

    const order = await GuestOrder.findOne({
      _id: orderId,
      "guestInfo.email": email
    }).populate("products.product");

    if (!order) {
      return errorRes(res, 404, "Order not found");
    }

    successRes(res, {
      order,
      message: "Order retrieved successfully"
    });

  } catch (error) {
    console.error("Error getting guest order:", error);
    internalServerError(res, "Error retrieving order");
  }
});

// Convert guest to user account
module.exports.convertGuestToUser = catchAsync(async (req, res) => {
  try {
    const { token, password, name } = req.body;

    if (!token || !password || !name) {
      return errorRes(res, 400, "Token, password, and name are required");
    }

    // Find guest order with valid token
    const guestOrder = await GuestOrder.findOne({
      conversionToken: token,
      "conversionToken.expires": { $gt: new Date() },
      convertedToUser: null
    });

    if (!guestOrder) {
      return errorRes(res, 400, "Invalid or expired token");
    }

    // Check if user already exists
    const User = require("../models/user.model");
    const existingUser = await User.findOne({ 
      email: guestOrder.guestInfo.email 
    });

    if (existingUser) {
      return errorRes(res, 400, "Account already exists with this email");
    }

    // Create new user account
    const bcrypt = require("bcrypt");
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name: name,
      email: guestOrder.guestInfo.email,
      phoneNumber: guestOrder.guestInfo.phoneNumber,
      password: hashedPassword,
      shippingAddress: [guestOrder.shippingAddress]
    });

    const savedUser = await newUser.save();

    // Create cart for new user
    const User_Cart = require("../models/cart.model");
    const newCart = new User_Cart({
      userId: savedUser._id,
      products: []
    });
    await newCart.save();

    // Convert guest order to user order
    await guestOrder.convertToUserOrder(savedUser._id);

    // Generate JWT token
    const jwt = require("jsonwebtoken");
    const token_jwt = jwt.sign(
      { _id: savedUser._id, role: "user" }, 
      process.env.JWT_SECRET_USER
    );

    // Set cookie with environment-aware options
    const isProd = process.env.NODE_ENV === "production";
    res.cookie("user_token", token_jwt, {
      httpOnly: true,
      secure: !!isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
    });

    successRes(res, {
      user: {
        _id: savedUser._id,
        name: savedUser.name,
        email: savedUser.email,
        phoneNumber: savedUser.phoneNumber,
        token: token_jwt
      },
      message: "Account created successfully"
    });

  } catch (error) {
    console.error("Error converting guest to user:", error);
    internalServerError(res, "Error creating account");
  }
});

// Send order confirmation email
// sendOrderConfirmationEmail moved to services/email.service.js
