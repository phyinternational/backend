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
const { buildPaginatedSortedFilteredQuery } = require("../utility/mogoose");
const { addProductUpdateNotification } = require("./notification.controller");
require("dotenv").config();

module.exports.placeOrder_post = catchAsync(async (req, res) => {
  const { products } = req.body;
  const { _id: userId } = req.user;

  //validate products and variants
  if (!products || products.length == 0)
    return errorRes(res, 400, "Cart is empty.");

  const response = await Promise.all(
    products.map(async (item) => {
      const productQuery = Product.findById(item.product);
      const variantQuery = ProductVariant.findById(item.variant);

      const [product, variant] = await Promise.all([
        productQuery,
        variantQuery,
      ]);

      if (!product || !variant)
        return errorRes(res, 400, "Invalid product or variant.");

      if (variant.stock < item.quantity)
        return errorRes(res, 400, "Out of stock.");

      return {
        product: product._id,
        variant: variant._id,
        quantity: item.quantity,
        price: variant.price,
      };
    })
  );

  const order = await User_Order.create({
    ...req.body,
    products: response,
    buyer: userId,
  });

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
  const orders = await buildPaginatedSortedFilteredQuery(
    User_Order.find()
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

  successRes(res, orders);
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
  ]);

  if (!order) return errorRes(res, 404, "Order not found.");

  if (String(order.buyer._id) !== String(userId))
    return errorRes(res, 403, "Unauthorized.");

  successRes(res, { data: order });
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
  ]);

  if (!order) return errorRes(res, 404, "Order not found.");

  successRes(res, { data: order });
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
          "_id displayName brand_title color price product_category displayImage availability",
      },
      {
        path: "coupon_applied",
        select: "_id code condition min_price discount_percent is_active",
      },
    ])
    .then((orders) => successRes(res, { orders }))
    .catch((err) => internalServerError(res, err));
});

module.exports.updateOrder_post = catchAsync( async (req, res) => {
  const { orderId } = req.params;
  const { payment_status, order_status } = req.body;
  const updates = {};

  if (!orderId) return errorRes(res, 400, "Order Id is required.");
  
  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(orderId)) {
    return errorRes(res, 400, "Invalid Order ID format.");
  }
  if (payment_status) updates.payment_status = payment_status;
  if (order_status) updates.order_status = order_status;

  if (Object.keys(updates).length == 0)
    return errorRes(res, 400, "No updates made.");

  User_Order.findByIdAndUpdate(orderId, updates, {
    new: true,
    runValidators: true,
  })
    .then((updatedOrder) => {
      if (!updatedOrder) return errorRes(res, 404, "Order does not exist.");
      updatedOrder
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
            updatedOrder: result,
            message: "Order updated successfully.",
          })
        )
        .catch((err) => internalServerError(res, err));
    })
    .catch((err) => internalServerError(res, err));
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
  const { _id: userId } = req.user;

  try {
    const {
      // razorpay payment verification
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
    } = req.body;

    const shasum = crypto.createHmac("sha256", process.env.RAZORPAY_TEST_KEY_SECRET);
    shasum.update(`${orderCreationId}|${razorpayPaymentId}`);
    const digest = shasum.digest("hex");

    // comaparing our digest with the actual signature

    const order = new User_Order({
      buyer: userId,
      products,
      order_price,
      coupon_applied,
      shippingAddress,
      payment_mode,
      payment_status: "COMPLETE",
      rzp_orderId: razorpayOrderId,
      rzp_paymentId: razorpayPaymentId,
    });

    if (digest !== razorpaySignature) {
      order.payment_status = "FAILED";
      await order.save();

      return errorRes(res, 400, "Transaction not legit!.");
    }

    // empty cart
    const cart = await User_Cart.findOne({ user: userId });
    cart.products = [];
    const updatedCart = await cart.save();

    // update products' availability
    await Promise.all(
      order.products.map(async (item) => {
        try {
          const product = await Product.findById(item.product._id);
          product.availability = product.availability - item.quantity;
          await product.save();
        } catch (err) {
          internalServerError(res, err);
        }
      })
    );

    await order
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
              updatedCart,
              message: "Order placed successfully.",
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
          // empty cart
          const cart = await User_Cart.findOne({ user: updatedOrder.buyer });
          cart.products = [];
          await cart.save();
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
