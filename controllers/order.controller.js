const mongoose = require("mongoose");
const User_Order = mongoose.model("User_Order");
const User = mongoose.model("User");
const User_Cart = mongoose.model("User_Cart");
const Product = mongoose.model("Product");
const asynchandler = require("express-async-handler");
const {
  errorRes,
  successRes,
  internalServerError,
  razorpayInstance,
} = require("../utility");
const crypto = require("crypto");
const qs = require("querystring");
const ccav = require("../utility/ccavutil");
const catchAsync = require("../utility/catch-async");
const ProductVariant = require("../models/product_varient");
const Inventory = require("../models/inventory.model");
const { buildPaginatedSortedFilteredQuery } = require("../utility/mogoose");
const { addProductUpdateNotification, createNotification } = require("./notification.controller");
require("dotenv").config();

// Helper to update inventory stock based on order status changes
const updateInventoryForOrder = async (order, type, reason, performedBy = null) => {
  try {
    const stockPromises = order.products.map(async (item) => {
      const inventory = await Inventory.findOne({
        product: item.product,
        variant: item.variant || null,
      });

      if (inventory) {
        await inventory.updateStock(item.quantity, type, reason, order._id, performedBy);
      }
    });

    await Promise.all(stockPromises);
  } catch (error) {
    console.error("Error updating inventory for order:", error);
  }
};

module.exports.placeOrder_post = catchAsync(async (req, res) => {
  const { products } = req.body;
  // Ensure request is authenticated
  if (!req.user || !req.user._id) {
    console.error('placeOrder_post: unauthenticated request attempted to place order', { bodySnippet: { productsLength: Array.isArray(products) ? products.length : 0 } });
    return errorRes(res, 401, 'Authentication required to place order');
  }
  const { _id: userId } = req.user;

  //validate products and variants
  if (!products || products.length == 0)
    return errorRes(res, 400, "Cart is empty.");

  const response = await Promise.all(
    products.map(async (item) => {
      const productQuery = Product.findById(item.product);
      // const variantQuery = ProductVariant.findById(item.variant);

      const [product] = await Promise.all([
        productQuery,
        // variantQuery,
      ]);

      if (!product)
        return errorRes(res, 400, "Invalid product or variant.");

      // if (variant.stock < item.quantity)
      //   return errorRes(res, 400, "Out of stock.");

      // Build product entry; include variant only when provided and not an empty string
      const prodEntry = {
        product: product?._id,
        quantity: item.quantity,
        price: product?.salePrice,
      };

      if (item.variant && String(item.variant).trim() !== "") {
        prodEntry.variant = item.variant;
      }

      return prodEntry;
    })
  );

  // Ensure required fields exist and have sensible defaults
  const payment_mode = req.body.payment_mode || 'ONLINE';
  // If ONLINE, mark payment_status as PENDING until verification; COD => PENDING as well
  const payment_status = req.body.payment_status || 'PENDING';

  // Build shipping address snapshot: prefer request payload, fallback to user's saved address
  const user = await User.findById(userId).select('shippingAddress email');
  const incomingAddr = req.body.shippingAddress || {};
  const shippingAddress = {
    firstName: incomingAddr.firstName || user?.shippingAddress?.firstName || "",
    lastName: incomingAddr.lastName || user?.shippingAddress?.lastName || "",
    email: incomingAddr.email || user?.email || "",
    phoneNumber: incomingAddr.phoneNumber || user?.shippingAddress?.phoneNumber || "",
    street: incomingAddr.street || user?.shippingAddress?.street || "",
    city: incomingAddr.city || user?.shippingAddress?.city || "",
    state: incomingAddr.state || user?.shippingAddress?.state || "",
    zip: incomingAddr.zip || user?.shippingAddress?.zip || "",
    country: incomingAddr.country || user?.shippingAddress?.country || "India",
  };

  // Validate required shipping fields (schema requires them)
  if (!shippingAddress.phoneNumber || !shippingAddress.street || !shippingAddress.city || !shippingAddress.state || !shippingAddress.zip) {
    return errorRes(res, 400, 'Incomplete shipping address. phoneNumber, street, city, state and zip are required.');
  }

  const orderPayload = {
    ...req.body,
    products: response,
    buyer: userId,
    payment_mode,
    payment_status,
    shippingAddress,
  };

  const order = await User_Order.create(orderPayload);

  console.log('📦 Order created with ID:', order._id);

  // remove ordered items from cart
  try {
    const cart = await User_Cart.findOne({ userId: userId });
    if (cart) {
      cart.products = cart.products.filter(cartItem => 
        !order.products.some(orderItem => 
          String(orderItem.product) === String(cartItem.productId) &&
          String(orderItem.variant || "") === String(cartItem.varientId || "")
        )
      );
      await cart.save();
    }
  } catch (err) {
    console.error('Error updating cart after order placement:', err);
  }

  // Send order confirmation email (fire-and-forget)
  try {
    const emailService = require('../services/email.service');
    // attempt to populate buyer email if not present
    const user = await User.findById(userId).select('email name');
    emailService.sendOrderConfirmation(order, user).catch(err => console.error(err));
  } catch (err) {
    console.error('Error triggering order confirmation email', err);
  }

  return successRes(res, {
    message: "Order placed successfully.",
    data: order,
  });
});

module.exports.getAllOrders_get = catchAsync(async (req, res) => {
  const { status, search, startDate, endDate, payment_mode, payment_status, minPrice, maxPrice } = req.query;
  let filter = {};

  if (status) {
    if (status === 'return') {
      // Match orders with order-level return status OR item-level return requests
      filter.$or = [
        { order_status: { $in: ['RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_REJECTED', 'RETURNED'] } },
        { 'item_return_requests.0': { $exists: true } }
      ];
    } else if (status === 'replacement') {
      // Match orders with order-level replacement status OR item-level replacement requests
      filter.$or = [
        { order_status: { $in: ['REPLACEMENT_REQUESTED', 'REPLACEMENT_APPROVED', 'REPLACEMENT_REJECTED', 'REPLACEMENT_IN_PROGRESS'] } },
        { 'item_replacement_requests.0': { $exists: true } }
      ];
    } else if (status === 'cancelled') {
      // Match orders with order-level cancelled status OR item-level cancellations
      filter.$or = [
        { order_status: { $in: ['CANCELLED_BY_USER', 'CANCELLED_BY_ADMIN', 'CANCELLED'] } },
        { 'cancelled_items.0': { $exists: true } }
      ];
    } else if (status === 'DELIVERED') {
      // Match orders that are DELIVERED, or orders whose status changed due to
      // item-level return/replacement requests (remaining items are still delivered)
      filter.$or = [
        { order_status: 'DELIVERED' },
        {
          order_status: { $in: ['RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_REJECTED', 'REPLACEMENT_REQUESTED', 'REPLACEMENT_APPROVED', 'REPLACEMENT_REJECTED'] },
          $or: [
            { 'item_return_requests.0': { $exists: true } },
            { 'item_replacement_requests.0': { $exists: true } }
          ]
        }
      ];
    } else {
      filter.order_status = status;
    }
  }

  // Date filter
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  // Payment mode and status
  if (payment_mode) filter.payment_mode = payment_mode;
  if (payment_status) filter.payment_status = payment_status;

  // Price range
  if (minPrice || maxPrice) {
    filter.total_amount_paid = {}; // Using total_amount_paid as it's the final value
    if (minPrice) filter.total_amount_paid.$gte = Number(minPrice);
    if (maxPrice) filter.total_amount_paid.$lte = Number(maxPrice);
  }

  // Basic search by order ID if provided
  if (search && search.length === 24) {
    filter._id = search;
  } else if (search) {
    // If search is not a 24-char ID, we could search in user name or something else in the future
    // for now keep it simple or use regex if supported in helper
  }

  const orders = await buildPaginatedSortedFilteredQuery(
    User_Order.find(filter)
      .sort("-createdAt")
      .populate([
        { path: "buyer" },
        {
          path: "products.product",
        },
        {
          path: "products.variant",
        },
        {
          path: "coupon_applied",
          select: "_id code condition min_price discount_percent is_active",
        },
      ]),
    req,
    User_Order
  );

  // Normalize paginated shape for frontend
  const page = orders.page || 1;
  const limit = orders.limit || (req.query.limit ? parseInt(req.query.limit, 10) : 10);
  const totalDocs = typeof orders.total === 'number' ? orders.total : (Array.isArray(orders) ? orders.length : 0);
  const totalPages = orders.totalPage || Math.max(1, Math.ceil(totalDocs / limit));

  const payload = {
    docs: orders, // keep full result for backward compatibility (includes items in result variable)
    page,
    limit,
    totalDocs,
    totalPages,
    hasPrevPage: page > 1,
    hasNextPage: page < totalPages,
  };

  successRes(res, payload);
});

module.exports.userOrderDetails_get = catchAsync(async (req, res) => {
  const { orderId } = req.params;
  const { _id: userId } = req.user;

  if (!orderId) return errorRes(res, 400, "Order Id is required.");

  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return errorRes(res, 400, "Invalid Order ID format.");
  }

  const order = await User_Order.findById(orderId).populate([
    { path: "buyer", select: "_id displayName email" },
    {
      path: "products.product",
    },
    {
      path: "products.variant",
    },
    {
      path: "coupon_applied",
    },
    {
      path: "parent_order",
      select: "_id order_status createdAt",
    },
  ]);

  if (!order) return errorRes(res, 404, "Order not found.");

  if (String(order.buyer._id) !== String(userId))
    return errorRes(res, 403, "Unauthorized.");

  // If this order has an approved replacement, find the child replacement order
  let replacementOrder = null;
  if (order.order_status === "REPLACEMENT_APPROVED") {
    replacementOrder = await User_Order.findOne({ parent_order: orderId })
      .select("_id order_status createdAt");
  }

  successRes(res, { data: order, replacementOrder });
});

module.exports.adminOrderDetails_get = catchAsync(async (req, res) => {
  const orderId = req.params.orderId ?? "";

  if (!Boolean(orderId)) return errorRes(res, 400, "Order Id is required.");

  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return errorRes(res, 400, "Invalid Order ID format.");
  }

  const order = await User_Order.findById(orderId).populate([
    { path: "buyer", select: "_id displayName email" },
    {
      path: "products.product",
    },
    {
      path: "products.variant",
      populate: {
        path: "color",
      },
    },
    {
      path: "coupon_applied",
    },
    {
      path: "parent_order",
      select: "_id order_status createdAt replacement_request",
    },
  ]);

  if (!order) return errorRes(res, 404, "Order not found.");

  // If this is a replacement order, also fetch any child replacement orders
  let replacementOrder = null;
  if (order.order_status === "REPLACEMENT_APPROVED") {
    replacementOrder = await User_Order.findOne({ parent_order: orderId }).select("_id order_status createdAt");
  }

  successRes(res, { data: order, replacementOrder });
});

module.exports.getYearWiseorder = asynchandler(async (req, res) => {
  const { year, limit, page } = req.query;
  if (!limit || !page || !year) {
    return errorRes(res, 400, "At least year is required");
  } else if (!limit || !page) {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);
    const query = {
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
    };
    const result = await User_Order.find(query);
    if (result) {
      successRes(res, result);
    } else {
      internalServerError(res, "Failed to get the desired orders");
    }
  } else {
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year + 1, 0, 1);
    const query = {
      createdAt: {
        $gte: startDate,
        $lt: endDate,
      },
    };
    const findData = await User_Order.find(query);
    if (findData) {
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const result = findData.slice(startIndex, endIndex);
      const finalResult = {
        result: result,
        totalPage: Math.ceil(findData.length / limit),
      };
      successRes(res, finalResult);
    } else {
      internalServerError(res, "Cannot find the results");
    }
  }
});

module.exports.userPreviousOrders_get = catchAsync(async (req, res) => {
  const { _id } = req.user;

  User_Order.find({ buyer: _id })
    .sort("-createdAt")
    .populate([
      { path: "buyer", select: "_id displayName email" },
      {
        path: "products.product",
        select:
          "_id productTitle salePrice category productImageUrl",
      },
      {
        path: "products.variant",
      },
      {
        path: "coupon_applied",
        select: "_id code condition min_price discount_percent is_active",
      },
    ])
    .then((orders) => successRes(res, { orders }))
    .catch((err) => internalServerError(res, err));
});

module.exports.updateOrder_post = catchAsync(async (req, res) => {
  const { orderId } = req.params;
  const { payment_status, order_status, reason } = req.body;

  if (!orderId) return errorRes(res, 400, "Order Id is required.");

  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return errorRes(res, 400, "Invalid Order ID format.");
  }

  const order = await User_Order.findById(orderId);
  if (!order) return errorRes(res, 404, "Order does not exist.");

  // CRITICAL FIX: Check if this order has an approved replacement or return
  if (order_status) {
    if (order.order_status === "REPLACEMENT_APPROVED") {
      // Find the replacement order (child order)
      const replacementOrder = await User_Order.findOne({ parent_order: orderId });

      if (replacementOrder) {
        return errorRes(res, 400,
          `Cannot update this order - a replacement order has been created. ` +
          `Please update the replacement order instead (Order ID: ${replacementOrder._id}). ` +
          `This order should remain as REPLACEMENT_APPROVED.`
        );
      }
    }

    // Prevent updating orders that are already in terminal states (after replacement/return)
    if (["RETURNED", "REPLACEMENT_IN_PROGRESS"].includes(order.order_status)) {
      return errorRes(res, 400,
        `This order is in ${order.order_status} status and should not be updated further. ` +
        `If this is for a replacement, please update the new replacement order instead.`
      );
    }
  }

  if (payment_status) order.payment_status = payment_status;

  if (order_status) {
    const oldStatus = order.order_status;
    const normalizedStatus = typeof order_status === 'string'
      ? order_status.trim().replace(/\s+/g, '_').toUpperCase()
      : order_status;

    order.order_status = normalizedStatus;

    // Handle delivery timestamp
    if (normalizedStatus === "DELIVERED" && oldStatus !== "DELIVERED") {
      order.deliveredAt = new Date();
    }

    // Handle inventory restocking for cancellations or returns
    if ((normalizedStatus === "CANCELLED_BY_ADMIN" || normalizedStatus === "RETURNED") && oldStatus !== normalizedStatus) {
      await updateInventoryForOrder(order, "RETURN", normalizedStatus === "RETURNED" ? "Customer Return" : "Admin Cancellation", req.admin?._id);
    }

    // Record in history
    order.status_history.push({
      status: normalizedStatus,
      reason: reason || "Status updated by admin",
      updatedBy: req.admin?._id,
      updatedAt: new Date(),
    });
  }

  await order.save();

  const result = await order.populate([
    { path: "buyer", select: "_id name email" },
    {
      path: "products.product",
      select: "_id productTitle skuNo productImageUrl salePrice",
    },
    { path: "products.variant" },
    {
      path: "coupon_applied",
      select: "_id code condition min_price discount_percent is_active",
    },
  ]);

  return successRes(res, {
    updatedOrder: result,
    message: "Order updated successfully.",
  });
});

module.exports.userOrderUpadte_put = catchAsync(async (req, res) => {
  const { orderId } = req.params;
  const { _id: userId } = req.user;
  const { products } = req.body;

  if (!orderId) return errorRes(res, 400, "Order Id is required.");
  
  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return errorRes(res, 400, "Invalid Order ID format.");
  }

  const order = await User_Order.findById(orderId);

  if (!order) return errorRes(res, 404, "Order not found.");

  if(order.order_status === "CANCELLED") return errorRes(res, 400, "Order is already cancelled.");

  if(order.order_status !== "PLACED") return errorRes(res, 400, "Order is already Shipped.");

  if (String(order.buyer) !== String(userId))
    return errorRes(res, 403, "Unauthorized.");

  const newProducts = order.products.map((item) => {
    const newQuantity = products.find(
      (prod) => String(prod.product) == String(item.product)
    );
    console.log(JSON.stringify(products));

    if (!newQuantity) return item;

    if (newQuantity.quantity > item.quantity)
      return errorRes(
        res,
        400,
        `Cannot increase quantity of product ${item.product.displayName} more than ${item.quantity}.`
      );

    return {
      product: item.product,
      variant: item.variant,
      quantity: newQuantity.quantity,
      price: item.price,
    };
  });

  order.products = newProducts;

  const updatedOrder = await order.save();
  const notification = await addProductUpdateNotification(userId, orderId);
  successRes(res, {
    updatedOrder,
    message: "Order updated successfully.",
  });
});

// rzp
module.exports.createRzpOrder_post = async (req, res) => {
  const { amount, currency, receipt, notes } = req.body;
  const amountInPaise = Math.round(amount * 100);

  const options = {
    amount: amountInPaise, // required as integer paise
    currency: currency || "INR",
    receipt: receipt || `rcpt_${Date.now()}`,
    notes: notes || {},
  };
  razorpayInstance.orders.create(options, (err, order) => {
    if (!err) successRes(res, { order });
    else internalServerError(res, err);
  });
};

module.exports.rzpPaymentVerification = async (req, res) => {
  // For guest orders, req.user might not exist
  const { _id: userId } = req.user || {};

  console.log('🔐 Payment verification received');
  console.log('🔐 Request body keys:', Object.keys(req.body));
  console.log('🔐 orderId from body:', req.body.orderId);

  try {
    const {
      // razorpay payment verification
      orderId, // CRITICAL: The existing order ID from placeOrder
      orderCreationId,
      razorpayPaymentId,
      razorpayOrderId,
      razorpaySignature,
      // update db
      products,
      order_price,
      coupon_applied,
      shippingAddress,
      payment_mode,
      isGuestOrder = false,
    } = req.body;

    console.log('🔐 Extracted orderId:', orderId);
    console.log('🔐 isGuestOrder:', isGuestOrder);

    const shasum = crypto.createHmac("sha256", process.env.RAZORPAY_TEST_KEY_SECRET);
    shasum.update(`${orderCreationId}|${razorpayPaymentId}`);
    const digest = shasum.digest("hex");

    // Verify signature
    if (digest !== razorpaySignature) {
      return errorRes(res, 400, "Transaction not legit!.");
    }

    if (isGuestOrder) {
      // Handle guest order payment verification
      const { guestInfo, billingAddress } = req.body;

      // Create guest order after successful payment
      const GuestOrder = require('../models/guest-order.model');
      const Product = require('../models/product.model');

      // Validate and calculate product prices
      let orderSubtotal = 0;
      let totalGST = 0;
      const processedProducts = [];

      for (const item of products) {
        const product = await Product.findById(item.productId);
        if (!product) {
          return errorRes(res, 400, `Product not found: ${item.productId}`);
        }

        let itemPrice = product.staticPrice || product.salePrice || product.price || 0;
        const gstAmount = (product.gst / 100) * itemPrice;
        const priceBreakdown = {
          basePrice: itemPrice,
          gstAmount: gstAmount,
          finalPrice: itemPrice + gstAmount,
        };

        const totalItemPrice = itemPrice * item.quantity;
        const itemGST = priceBreakdown.gstAmount * item.quantity;

        processedProducts.push({
          product: product._id,
          quantity: item.quantity,
          price: itemPrice,
          variant: item.variantId || null,
          priceBreakdown: priceBreakdown
        });

        orderSubtotal += totalItemPrice;
        totalGST += itemGST;
      }

      const finalAmount = orderSubtotal - 0; // No coupon for now

      // Create guest order
      const guestOrder = new GuestOrder({
        guestInfo,
        products: processedProducts,
        shippingAddress,
        billingAddress,
        orderTotal: {
          subtotal: orderSubtotal,
          gstAmount: totalGST,
          discount: 0,
          finalAmount: finalAmount
        },
        paymentInfo: {
          method: "ONLINE",
          status: "COMPLETE",
          razorpayOrderId,
          razorpayPaymentId
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      const savedOrder = await guestOrder.save();

      // Generate conversion token for post-purchase account creation
      const crypto = require('crypto');
      const conversionToken = crypto.randomBytes(32).toString('hex');
      savedOrder.conversionToken = conversionToken;
      savedOrder.conversionToken.expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await savedOrder.save();

      // Send order confirmation email
      try {
        const emailService = require('../services/email.service');
        emailService.sendGuestOrderConfirmation(savedOrder).catch(err => console.error(err));
      } catch (err) {
        console.error('Error sending guest order confirmation email:', err);
      }

      return successRes(res, {
        order: savedOrder,
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
        message: "Guest order placed successfully.",
      });
    }

    // Regular user order payment verification
    // Ensure we have an authenticated user for non-guest orders
    if (!isGuestOrder && !userId) {
      console.error('rzpPaymentVerification: missing authenticated user for non-guest order', {
        reqUser: req.user,
        bodySnippet: {
          orderCreationId,
          razorpayPaymentId,
          razorpayOrderId,
          productsLength: Array.isArray(products) ? products.length : 0,
          order_price,
        },
      });
      return errorRes(res, 401, 'Authentication required to verify payment for user orders');
    }

    // CRITICAL FIX: Update existing order instead of creating a new one
    if (!orderId) {
      console.error('rzpPaymentVerification: missing orderId to update existing order');
      return errorRes(res, 400, 'Order ID is required for payment verification');
    }

    // Find the existing order created by placeOrder
    const existingOrder = await User_Order.findById(orderId);
    if (!existingOrder) {
      console.error('rzpPaymentVerification: order not found', { orderId });
      return errorRes(res, 404, 'Order not found');
    }

    // Verify the order belongs to the authenticated user
    if (String(existingOrder.buyer) !== String(userId)) {
      console.error('rzpPaymentVerification: order does not belong to user', { 
        orderId, 
        orderBuyer: existingOrder.buyer, 
        userId 
      });
      return errorRes(res, 403, 'Unauthorized: Order does not belong to user');
    }

    // Update the existing order with payment details
    existingOrder.payment_status = "COMPLETE";
    existingOrder.rzp_orderId = razorpayOrderId;
    existingOrder.rzp_paymentId = razorpayPaymentId;

    // remove ordered items from cart
    const cart = await User_Cart.findOne({ userId: userId });
    if (cart) {
      cart.products = cart.products.filter(cartItem => 
        !existingOrder.products.some(orderItem => 
          String(orderItem.product) === String(cartItem.productId) &&
          String(orderItem.variant || "") === String(cartItem.varientId || "")
        )
      );
      await cart.save();
    }

    // update products' availability
    await Promise.all(
      existingOrder.products.map(async (item) => {
        try {
          const product = await Product.findById(item.product);
          if (product) {
            product.availability = product.availability - item.quantity;
            await product.save();
          }
        } catch (err) {
          console.error('Error updating product availability:', err);
        }
      })
    );

    await existingOrder
      .save()
      .then((savedOrder) => {
        savedOrder
          .populate([
            { path: "buyer", select: "_id displayName email" },
            {
              path: "products.product",
              select:
                "_id displayName brand_title color price product_category displayImage availability",
            },
            {
              path: "coupon_applied",
              select: "_id code condition min_price discount_percent is_active",
            },
          ])
          .then(async (result) => {
            // send email confirmation
            try {
              const emailService = require('../services/email.service');
              const user = await User.findById(userId).select('email name');
              emailService.sendOrderConfirmation(result, user).catch(e => console.error(e));
            } catch (e) {
              console.error('Error triggering email after rzp payment', e);
            }

            successRes(res, {
              order: result,
              orderId: razorpayOrderId,
              paymentId: razorpayPaymentId,
              updatedCart: cart ? { products: [] } : null,
              message: "Payment verified and order updated successfully.",
            });
          });
      })
      .catch((err) => internalServerError(res, err));
  } catch (error) {
    internalServerError(res, error);
  }
};

// ccavenue controllers
module.exports.ccavenue_creatOrder_post = async (req, res) => {
  // Ensure authenticated
  if (!req.user || !req.user._id) {
    console.error('ccavenue_creatOrder_post: unauthenticated request');
    return errorRes(res, 401, 'Authentication required');
  }
  const { _id: userId } = req.user;
  const { products, order_price, coupon_applied, shippingAddress } = req.body;
  // make cart empty

  if (!products || !order_price || !shippingAddress)
    return errorRes(res, 400, "All fields are required.");
  if (products.length == 0) return errorRes(res, 400, "Cart is empty.");

  try {
    await Promise.all(
      products.map((item) => {
        if (!item.quantity >= 1)
          return errorRes(res, 400, "Remove products from with zero quantity.");
        Product.findById(item.product).then((prod) => {
          if (!prod)
            return errorRes(
              res,
              400,
              `Internal server error. Please refresh cart.`
            );
          if (!prod.availability >= 1)
            return errorRes(
              res,
              400,
              "Remove out of stock products from cart."
            );
          if (!prod.availability >= item.quantity)
            return errorRes(
              res,
              400,
              `Cannot place order for product ${prod.displayName} with quantity more than ${prod.availability}`
            );
        });
      })
    );

    const order = new User_Order({
      buyer: userId,
      products,
      order_price,
      coupon_applied,
      shippingAddress,
      payment_mode: "ONLINE",
      payment_status: "PENDING",
    });

    await order
      .save()
      .then(async (savedOrder) => {
        // Notify Admin
        await createNotification({
          userId: userId,
          orderId: savedOrder._id,
          type: 'NEW_ORDER',
          title: 'New Order Placed',
          text: `A new order #${savedOrder._id} has been placed by ${req.user.displayName || 'Customer'}.`
        });

        savedOrder
          .populate([
            { path: "buyer", select: "_id displayName email" },
            {
              path: "products.product",
              select:
                "_id displayName brand_title color price product_category displayImage availability",
            },
            {
              path: "coupon_applied",
              select: "_id code condition min_price discount_percent is_active",
            },
          ])
          .then((result) =>
            successRes(res, {
              order: result,
              message: "Order placed successfully.",
            })
          );
      })
      .catch((err) => internalServerError(res, err));
  } catch (error) {
    internalServerError(res, error);
  }
};

module.exports.ccavenuerequesthandler = (request, response) => {
  var body = "",
    workingKey = "5843BAB2CA2A191D060233093430D41F",
    accessCode = "AVXE03KH83CH04EXHC",
    encRequest = "",
    formbody = "";

  //Generate Md5 hash for the key and then convert in base64 string
  var md5 = crypto.createHash("md5").update(workingKey).digest();
  var keyBase64 = Buffer.from(md5).toString("base64");

  //Initializing Vector and then convert in base64 string
  var ivBase64 = Buffer.from([
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
    0x0c, 0x0d, 0x0e, 0x0f,
  ]).toString("base64");

  request.on("data", function (data) {
    body += data;
    encRequest = ccav.encrypt(body, keyBase64, ivBase64);
    // formbody =
    //   '<form id="nonseamless" method="post" name="redirect" action="https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction"/> <input type="hidden" id="encRequest" name="encRequest" value="' +
    //   encRequest +
    //   '"><input type="hidden" name="access_code" id="access_code" value="' +
    //   accessCode +
    //   '"><script language="javascript">document.redirect.submit();</script></form>';
    url = `https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction&encRequest=${encRequest}&access_code=${accessCode}`;
  });

  request.on("end", function () {
    response.writeHeader(200, { "Content-Type": "text/html" });
    // response.write(formbody);
    // response.json({
    //   url: "https://secure.ccavenue.com/transaction/transaction.do?command=initiateTransaction",
    //   encRequest,
    //   accessCode,
    // });
    response.write(url);
    response.end();
  });
  return;
};

module.exports.ccavenueresponsehandler = async (request, response) => {
  var ccavEncResponse = "",
    ccavResponse = "",
    workingKey = "5843BAB2CA2A191D060233093430D41F",
    ccavPOST = "";

  //Generate Md5 hash for the key and then convert in base64 string
  var md5 = crypto.createHash("md5").update(workingKey).digest();
  var keyBase64 = Buffer.from(md5).toString("base64");

  //Initializing Vector and then convert in base64 string
  var ivBase64 = Buffer.from([
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
    0x0c, 0x0d, 0x0e, 0x0f,
  ]).toString("base64");

  request.on("data", function (data) {
    ccavEncResponse += data;
    ccavPOST = qs.parse(ccavEncResponse);
    var encryption = ccavPOST.encResp;
    ccavResponse = ccav.decrypt(encryption, keyBase64, ivBase64);
  });

  request.on("end", async function () {
    console.log(ccavResponse, "<<ccaveres");

    const orderData = JSON.parse(
      '{"' + ccavResponse.replace(/&/g, '","').replace(/=/g, '":"') + '"}',
      function (key, value) {
        return key === "" ? value : decodeURIComponent(value);
      }
    );
    console.log(orderData, "<<<orderData");

    if (orderData.order_status === "Success") {
      const orderUpdates = {
        cc_orderId: orderData.order_id,
        cc_bankRefNo: orderData.bank_ref_no,
        payment_status: "COMPLETE",
        order_price: `${orderData.amount} ${orderData.currency}`,
        shippingAddress: {
          address: `${orderData.delivery_name}, ${orderData.delivery_address}, ${orderData.delivery_city}, ${orderData.delivery_state}, ${orderData.delivery_country}, ${orderData.delivery_tel}`,
          pincode: orderData.delivery_zip,
        },
      };

      await User_Order.findByIdAndUpdate(orderData.order_id, orderUpdates, {
        new: true,
      })
          .then(async (updatedOrder) => {
          console.log(updatedOrder, "<<<updated Order");
          // update products' availability
          // await Promise.all(
          //   updatedOrder.products.map(async (item) => {
          //     try {
          //       const product = await Product.findById(item.product._id);
          //       product.availability = product.availability - item.quantity;
          //       await product.save();
          //     } catch (err) {
          //       internalServerError(res, err);
          //     }
          //   })
          // );
          // remove ordered items from cart
          const cart = await User_Cart.findOne({ userId: updatedOrder.buyer });
          if (cart) {
            cart.products = cart.products.filter(cartItem => 
              !updatedOrder.products.some(orderItem => 
                String(orderItem.product) === String(cartItem.productId) &&
                String(orderItem.variant || "") === String(cartItem.varientId || "")
              )
            );
            await cart.save();
          }
          try {
            const emailService = require('../services/email.service');
            const user = await User.findById(updatedOrder.buyer).select('email name');
            emailService.sendOrderConfirmation(updatedOrder, user).catch(e => console.error(e));
          } catch (e) {
            console.error('Error triggering email after ccavenue payment', e);
          }
        })
        .catch((err) => console.log(err));

      // var pData = "";
      // pData = "<table border=1 cellspacing=2 cellpadding=2><tr><td>";
      // pData = pData + ccavResponse.replace(/=/gi, "</td><td>");
      // pData = pData.replace(/&/gi, "</td></tr><tr><td>");
      // pData = pData + "</td></tr></table>";
      // htmlcode =
      //   '<html><head><meta http-equiv="Content-Type" content="text/html; charset=UTF-8"><title>Response Handler</title></head><body><center><font size="4" color="blue"><b>Response Page</b></font><br>' +
      //   pData +
      //   "</center><br></body></html>";
      // response.writeHeader(200, { "Content-Type": "text/html" });
      // response.write(htmlcode);
      // response.end();

      response
        .writeHead(301, {
          Location: "https://www.thetribes.in/#/cart",
        })
        .end();
    } else if (orderData.order_status === "Aborted") {
      await User_Order.findByIdAndDelete(orderData.order_id)
        .then((deletedOrder) => console.log(deletedOrder, "<< Order deleted."))
        .catch((err) => console.log(err));

      response
        .writeHead(301, {
          Location: "https://www.thetribes.in",
        })
        .end();
    } else {
      response
        .writeHead(301, {
          Location: `https://www.thetribes.in`,
        })
        .end();
    }
  });
};

module.exports.cancelOrderByUser = catchAsync(async (req, res) => {
  const { orderId } = req.params;
  const { reason, product_id, variant_id, quantity } = req.body;

  if (!reason) return errorRes(res, 400, "Cancellation reason is required.");

  const order = await User_Order.findById(orderId);
  if (!order) return errorRes(res, 404, "Order not found.");

  if (order.buyer.toString() !== req.user._id.toString()) {
    return errorRes(res, 403, "You are not authorized to cancel this order.");
  }

  const hoursSincePlacement = (Date.now() - order.createdAt) / (1000 * 60 * 60);
  if (hoursSincePlacement > 48) {
    return errorRes(res, 400, "Orders can only be cancelled within 48 hours of placement.");
  }

  if (order.order_status !== "PLACED") {
    return errorRes(res, 400, "Only orders in 'PLACED' status can be cancelled.");
  }

  // Item-level cancellation (new behavior)
  if (product_id) {
    // Verify product exists in order
    const orderItem = order.products.find(
      p => p.product.toString() === product_id &&
           (variant_id ? p.variant?.toString() === variant_id : true)
    );

    if (!orderItem) {
      return errorRes(res, 400, "Product not found in this order.");
    }

    // Check if item is already cancelled
    if (!order.cancelled_items) order.cancelled_items = [];

    const alreadyCancelled = order.cancelled_items.find(
      c => c.product.toString() === product_id &&
           (variant_id ? c.variant?.toString() === variant_id : true)
    );

    if (alreadyCancelled) {
      return errorRes(res, 400, "This item has already been cancelled.");
    }

    // Add to cancelled_items array
    order.cancelled_items.push({
      product: product_id,
      variant: variant_id || null,
      quantity: quantity || orderItem.quantity,
      reason,
      cancelledAt: new Date(),
    });

    // Check if ALL items are now cancelled
    const allItemsCancelled = order.products.every(p => {
      return order.cancelled_items.some(
        c => c.product.toString() === p.product.toString() &&
             (p.variant ? c.variant?.toString() === p.variant.toString() : !c.variant)
      );
    });

    // Only change order status if all items are cancelled
    if (allItemsCancelled) {
      order.order_status = "CANCELLED_BY_USER";
      order.cancellation = {
        reason: "All items cancelled",
        cancelledAt: new Date(),
      };
    }

    order.status_history.push({
      status: allItemsCancelled ? "CANCELLED_BY_USER" : "PLACED",
      reason: `Item cancelled: ${product_id}`,
      updatedAt: new Date(),
    });

    await order.save();

    // Restock only the cancelled item
    const inventory = await Inventory.findOne({
      product: product_id,
      variant: variant_id || null,
    });

    if (inventory) {
      await inventory.updateStock(
        quantity || orderItem.quantity,
        "RETURN",
        "User Cancellation - Individual Item",
        order._id,
        null
      );
    }

    // Notify Admin
    await createNotification({
      userId: req.user._id,
      orderId: order._id,
      type: 'CANCELLATION',
      title: 'Item Cancelled',
      text: `User ${req.user.displayName || 'Customer'} has cancelled an item in Order #${order._id}. Reason: ${reason}`
    });

    return successRes(res, {
      message: allItemsCancelled ? "All items cancelled." : "Item cancelled successfully.",
      data: order
    });
  }

  // Fallback: Order-level cancellation (backward compatibility)
  order.order_status = "CANCELLED_BY_USER";
  order.cancellation = {
    reason,
    cancelledAt: new Date(),
  };
  order.status_history.push({
    status: "CANCELLED_BY_USER",
    reason,
    updatedAt: new Date(),
  });

  await order.save();

  // Restock all items
  await updateInventoryForOrder(order, "RETURN", "User Cancellation", null);

  // Notify Admin
  await createNotification({
    userId: req.user._id,
    orderId: order._id,
    type: 'CANCELLATION',
    title: 'Order Cancelled',
    text: `User ${req.user.displayName || 'Customer'} has cancelled Order #${order._id}. Reason: ${reason}`
  });

  return successRes(res, { message: "Order cancelled successfully.", data: order });
});

module.exports.requestReturn = catchAsync(async (req, res) => {
  const { orderId } = req.params;
  const { reason, proof_images, product_id, variant_id, quantity } = req.body;

  if (!reason) return errorRes(res, 400, "Return reason is required.");

  // Require at least one proof image
  if (!proof_images || !Array.isArray(proof_images) || proof_images.length === 0) {
    return errorRes(res, 400, "At least one product photo is required for return requests.");
  }

  const order = await User_Order.findById(orderId);
  if (!order) return errorRes(res, 404, "Order not found.");

  if (order.buyer.toString() !== req.user._id.toString()) {
    return errorRes(res, 403, "You are not authorized for this action.");
  }

  // Allow returns when order is DELIVERED, or when another item already triggered a return/replacement request
  const allowedReturnStatuses = ["DELIVERED", "RETURN_REQUESTED", "REPLACEMENT_REQUESTED"];
  if (!allowedReturnStatuses.includes(order.order_status)) {
    return errorRes(res, 400, "Returns can only be requested after delivery.");
  }

  const daysSinceDelivery = (Date.now() - (order.deliveredAt || order.updatedAt)) / (1000 * 60 * 60 * 24);
  if (daysSinceDelivery > 7) {
    return errorRes(res, 400, "7-day return window has expired.");
  }

  // Item-level return request (new behavior)
  if (product_id) {
    // Verify product exists in order
    const orderItem = order.products.find(
      p => p.product.toString() === product_id &&
           (variant_id ? p.variant?.toString() === variant_id : true)
    );

    if (!orderItem) {
      return errorRes(res, 400, "Product not found in this order.");
    }

    // Check if return already exists for this specific item
    if (!order.item_return_requests) order.item_return_requests = [];

    const existingReturn = order.item_return_requests.find(
      r => r.product.toString() === product_id &&
           r.status === 'PENDING' &&
           (variant_id ? r.variant?.toString() === variant_id : true)
    );

    if (existingReturn) {
      return errorRes(res, 400, "A return request already exists for this item.");
    }

    // Check if replacement already exists for this item
    if (order.item_replacement_requests) {
      const existingReplacement = order.item_replacement_requests.find(
        r => r.product.toString() === product_id &&
             r.status === 'PENDING' &&
             (variant_id ? r.variant?.toString() === variant_id : true)
      );

      if (existingReplacement) {
        return errorRes(res, 400, "A replacement request already exists for this item. Cannot request both.");
      }
    }

    // Add item-level return request
    order.item_return_requests.push({
      product: product_id,
      variant: variant_id || null,
      quantity: quantity || orderItem.quantity,
      reason,
      proof_images,
      status: "PENDING",
      requestedAt: new Date(),
    });

    // Update order status if this is the first item-level request
    if (!order.order_status.includes('RETURN')) {
      order.order_status = "RETURN_REQUESTED";
    }

    order.status_history.push({
      status: "RETURN_REQUESTED",
      reason: `Return requested for item: ${product_id}`,
      updatedAt: new Date(),
    });

    await order.save();

    // Notify Admin
    await createNotification({
      userId: req.user._id,
      orderId: order._id,
      type: 'RETURN_REQUEST',
      title: 'Return Requested',
      text: `User ${req.user.displayName || 'Customer'} requested a return for an item in Order #${order._id}. Reason: ${reason}`
    });

    return successRes(res, { message: "Return requested successfully for the item.", data: order });
  }

  // Fallback: Order-level return request (backward compatibility)
  // Check if return or replacement request already exists
  if (order.return_request) {
    return errorRes(res, 400, "A return request already exists for this order.");
  }
  if (order.replacement_request) {
    return errorRes(res, 400, "A replacement request already exists for this order. Cannot request both return and replacement.");
  }

  order.order_status = "RETURN_REQUESTED";
  order.return_request = {
    reason,
    proof_images: proof_images || [],
    status: "PENDING",
    requestedAt: new Date(),
  };
  order.status_history.push({
    status: "RETURN_REQUESTED",
    reason,
    updatedAt: new Date(),
  });

  await order.save();

  // Notify Admin
  await createNotification({
    userId: req.user._id,
    orderId: order._id,
    type: 'RETURN_REQUEST',
    title: 'Return Requested',
    text: `User ${req.user.displayName || 'Customer'} requested a return for Order #${order._id}. Reason: ${reason}`
  });

  return successRes(res, { message: "Return requested successfully.", data: order });
});

module.exports.requestReplacement = catchAsync(async (req, res) => {
  const { orderId } = req.params;
  const { reason, proof_images, product_id, variant_id, quantity } = req.body;

  if (!reason) return errorRes(res, 400, "Replacement reason is required.");

  // Require at least one proof image
  if (!proof_images || !Array.isArray(proof_images) || proof_images.length === 0) {
    return errorRes(res, 400, "At least one product photo is required for replacement requests.");
  }

  const order = await User_Order.findById(orderId);
  if (!order) return errorRes(res, 404, "Order not found.");

  if (order.buyer.toString() !== req.user._id.toString()) {
    return errorRes(res, 403, "You are not authorized for this action.");
  }

  // Allow replacements when order is DELIVERED, or when another item already triggered a return/replacement request
  const allowedReplacementStatuses = ["DELIVERED", "RETURN_REQUESTED", "REPLACEMENT_REQUESTED"];
  if (!allowedReplacementStatuses.includes(order.order_status)) {
    return errorRes(res, 400, "Replacement can only be requested after delivery.");
  }

  const daysSinceDelivery = (Date.now() - (order.deliveredAt || order.updatedAt)) / (1000 * 60 * 60 * 24);
  if (daysSinceDelivery > 7) {
    return errorRes(res, 400, "7-day replacement window has expired.");
  }

  // Item-level replacement request (new behavior)
  if (product_id) {
    // Verify product exists in order
    const orderItem = order.products.find(
      p => p.product.toString() === product_id &&
           (variant_id ? p.variant?.toString() === variant_id : true)
    );

    if (!orderItem) {
      return errorRes(res, 400, "Product not found in this order.");
    }

    // Check if replacement already exists for this specific item
    if (!order.item_replacement_requests) order.item_replacement_requests = [];

    const existingReplacement = order.item_replacement_requests.find(
      r => r.product.toString() === product_id &&
           r.status === 'PENDING' &&
           (variant_id ? r.variant?.toString() === variant_id : true)
    );

    if (existingReplacement) {
      return errorRes(res, 400, "A replacement request already exists for this item.");
    }

    // Check if return already exists for this item
    if (order.item_return_requests) {
      const existingReturn = order.item_return_requests.find(
        r => r.product.toString() === product_id &&
             r.status === 'PENDING' &&
             (variant_id ? r.variant?.toString() === variant_id : true)
      );

      if (existingReturn) {
        return errorRes(res, 400, "A return request already exists for this item. Cannot request both.");
      }
    }

    // Add item-level replacement request
    order.item_replacement_requests.push({
      product: product_id,
      variant: variant_id || null,
      quantity: quantity || orderItem.quantity,
      reason,
      proof_images,
      status: "PENDING",
      requestedAt: new Date(),
    });

    // Update order status if this is the first item-level request
    if (!order.order_status.includes('REPLACEMENT')) {
      order.order_status = "REPLACEMENT_REQUESTED";
    }

    order.status_history.push({
      status: "REPLACEMENT_REQUESTED",
      reason: `Replacement requested for item: ${product_id}`,
      updatedAt: new Date(),
    });

    await order.save();

    // Notify Admin
    await createNotification({
      userId: req.user._id,
      orderId: order._id,
      type: 'REPLACEMENT_REQUEST',
      title: 'Replacement Requested',
      text: `User ${req.user.displayName || 'Customer'} requested a replacement for an item in Order #${order._id}. Reason: ${reason}`
    });

    return successRes(res, { message: "Replacement requested successfully for the item.", data: order });
  }

  // Fallback: Order-level replacement request (backward compatibility)
  // Check if return or replacement request already exists
  if (order.replacement_request) {
    return errorRes(res, 400, "A replacement request already exists for this order.");
  }
  if (order.return_request) {
    return errorRes(res, 400, "A return request already exists for this order. Cannot request both return and replacement.");
  }

  order.order_status = "REPLACEMENT_REQUESTED";
  order.replacement_request = {
    reason,
    proof_images: proof_images || [],
    status: "PENDING",
    requestedAt: new Date(),
  };
  order.status_history.push({
    status: "REPLACEMENT_REQUESTED",
    reason,
    updatedAt: new Date(),
  });

  await order.save();

  // Notify Admin
  await createNotification({
    userId: req.user._id,
    orderId: order._id,
    type: 'REPLACEMENT_REQUEST',
    title: 'Replacement Requested',
    text: `User ${req.user.displayName || 'Customer'} requested a replacement for Order #${order._id}. Reason: ${reason}`
  });

  return successRes(res, { message: "Replacement requested successfully.", data: order });
});

module.exports.adminApproveRequest = catchAsync(async (req, res) => {
  const { orderId } = req.params;
  const { type, admin_comment, overrideWindow } = req.body; // type: 'return' or 'replacement'

  if (!admin_comment) return errorRes(res, 400, "Admin comment is required.");

  const order = await User_Order.findById(orderId);
  if (!order) return errorRes(res, 404, "Order not found.");

  // Role check for override if needed
  if (overrideWindow && req.admin?.accountType !== 'super-admin') {
    return errorRes(res, 403, "Only Super Admins can override the 7-day window.");
  }

  if (type === 'return') {
    // Check if it's an item-level or order-level return request
    if (order.item_return_requests && order.item_return_requests.length > 0) {
      // Item-level return request
      const pendingRequest = order.item_return_requests.find(r => r.status === 'PENDING');
      if (pendingRequest) {
        pendingRequest.status = "APPROVED";
        pendingRequest.admin_comment = admin_comment;
        pendingRequest.updatedAt = new Date();
      }
    } else if (order.return_request) {
      // Order-level return request
      order.return_request.status = "APPROVED";
      order.return_request.admin_comment = admin_comment;
      order.return_request.updatedAt = new Date();
    }
    order.order_status = "RETURN_APPROVED";
  } else if (type === 'replacement') {
    // Check if it's an item-level or order-level replacement request
    if (order.item_replacement_requests && order.item_replacement_requests.length > 0) {
      // Item-level replacement request
      const pendingRequest = order.item_replacement_requests.find(r => r.status === 'PENDING');
      if (pendingRequest) {
        pendingRequest.status = "APPROVED";
        pendingRequest.admin_comment = admin_comment;
        pendingRequest.updatedAt = new Date();

        // Create a new linked order for replacement (only for the specific item)
        const replacementOrder = new User_Order({
          buyer: order.buyer,
          products: [{
            product: pendingRequest.product,
            variant: pendingRequest.variant,
            quantity: pendingRequest.quantity,
            price: 0
          }],
          shippingAddress: order.shippingAddress,
          payment_mode: order.payment_mode,
          payment_status: "COMPLETE",
          order_status: "PLACED",
          parent_order: order._id,
        });
        await replacementOrder.save();

        // Decrease inventory for the replacement item
        await updateInventoryForOrder(replacementOrder, "OUT", "Replacement Order - Item Level", req.admin?._id);
      }
    } else if (order.replacement_request) {
      // Order-level replacement request
      order.replacement_request.status = "APPROVED";
      order.replacement_request.admin_comment = admin_comment;
      order.replacement_request.updatedAt = new Date();

      // Create a new linked order for replacement (all items)
      const replacementOrder = new User_Order({
        buyer: order.buyer,
        products: order.products.map(p => ({
          product: p.product,
          variant: p.variant,
          quantity: p.quantity,
          price: 0
        })),
        shippingAddress: order.shippingAddress,
        payment_mode: order.payment_mode,
        payment_status: "COMPLETE",
        order_status: "PLACED",
        parent_order: order._id,
      });
      await replacementOrder.save();

      // Decrease inventory for the new items
      await updateInventoryForOrder(replacementOrder, "OUT", "Replacement Order", req.admin?._id);
    }
    order.order_status = "REPLACEMENT_APPROVED";
  } else {
    return errorRes(res, 400, "Invalid request type.");
  }

  order.status_history.push({
    status: order.order_status,
    reason: admin_comment,
    updatedBy: req.admin?._id,
    updatedAt: new Date(),
  });

  await order.save();

  return successRes(res, { message: `${type} approved successfully.`, data: order });
});

module.exports.adminRejectRequest = catchAsync(async (req, res) => {
  const { orderId } = req.params;
  const { type, admin_comment } = req.body;

  if (!admin_comment) return errorRes(res, 400, "Admin comment is required.");

  const order = await User_Order.findById(orderId);
  if (!order) return errorRes(res, 404, "Order not found.");

  if (type === 'return') {
    // Check for item-level return request first
    if (order.item_return_requests && order.item_return_requests.length > 0) {
      const pendingRequest = order.item_return_requests.find(r => r.status === 'PENDING');
      if (pendingRequest) {
        pendingRequest.status = "REJECTED";
        pendingRequest.admin_comment = admin_comment;
        pendingRequest.updatedAt = new Date();
      }
    } else if (order.return_request) {
      // Order-level return request
      order.return_request.status = "REJECTED";
      order.return_request.admin_comment = admin_comment;
      order.return_request.updatedAt = new Date();
    }
    order.order_status = "RETURN_REJECTED";
  } else if (type === 'replacement') {
    // Check for item-level replacement request first
    if (order.item_replacement_requests && order.item_replacement_requests.length > 0) {
      const pendingRequest = order.item_replacement_requests.find(r => r.status === 'PENDING');
      if (pendingRequest) {
        pendingRequest.status = "REJECTED";
        pendingRequest.admin_comment = admin_comment;
        pendingRequest.updatedAt = new Date();
      }
    } else if (order.replacement_request) {
      // Order-level replacement request
      order.replacement_request.status = "REJECTED";
      order.replacement_request.admin_comment = admin_comment;
      order.replacement_request.updatedAt = new Date();
    }
    order.order_status = "REPLACEMENT_REJECTED";
  } else {
    return errorRes(res, 400, "Invalid request type.");
  }

  order.status_history.push({
    status: order.order_status,
    reason: admin_comment,
    updatedBy: req.admin?._id,
    updatedAt: new Date(),
  });

  await order.save();

  return successRes(res, { message: `${type} rejected successfully.`, data: order });
});
