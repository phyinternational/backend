const express = require("express");
const orderController = require("../controllers/order.controller");
const {
  requireUserLogin,
  requireAdminLogin,
} = require("../middlewares/requireLogin");
const validate = require("../validation/validate");
const { placeOrderValidation } = require("../validation/order");
const router = express.Router();

router.post(
  "/user/order/place",
  requireUserLogin,
  orderController.placeOrder_post
);


// rzp
router.post("/rzp/create-order", requireUserLogin, orderController.createRzpOrder_post);
router.post(
  "/rzp/payment-verification",
  requireUserLogin,
  orderController.rzpPaymentVerification
);


router.get(
  "/admin/order/all",
  requireAdminLogin,
  orderController.getAllOrders_get
);

router.get(
  "/admin/order/yearwise",
  requireAdminLogin,
  orderController.getYearWiseorder
);
router.get(
  "/user/order/all",
  requireUserLogin,
  orderController.userPreviousOrders_get
);

router.get(
  "/user/order/:orderId",
  requireUserLogin,
  orderController.userOrderDetails_get
);

router.put(
  "/user/order/update/:orderId",
  requireUserLogin,
  orderController.userOrderUpadte_put
);

router.put(
  "/admin/order/:orderId/update",
  requireAdminLogin,
  orderController.updateOrder_post
);

router.get(
  "/admin/order/:orderId",
  requireAdminLogin,
  orderController.adminOrderDetails_get
);

router.post(
  "/user/order/:orderId/cancel",
  requireUserLogin,
  orderController.cancelOrderByUser
);
router.post(
  "/user/order/:orderId/return",
  requireUserLogin,
  orderController.requestReturn
);
router.post(
  "/user/order/:orderId/replacement",
  requireUserLogin,
  orderController.requestReplacement
);

router.post(
  "/admin/order/:orderId/approve-request",
  requireAdminLogin,
  orderController.adminApproveRequest
);
router.post(
  "/admin/order/:orderId/reject-request",
  requireAdminLogin,
  orderController.adminRejectRequest
);

// ccavenue routes
router.post(
  "/ccavenue-createOrder",
  requireUserLogin,
  orderController.ccavenue_creatOrder_post
);

router.post(
  "/ccavenuerequesthandler",
  requireUserLogin,
  orderController.ccavenuerequesthandler
);

router.post(
  "/ccavenueresponsehandler",
  // requireUserLogin,
  orderController.ccavenueresponsehandler
);

module.exports = router;
