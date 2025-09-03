const express = require("express");
const {
  requireAdminLogin,
  requireUserLogin,
} = require("../middlewares/requireLogin");
const userController = require("../controllers/user.controller");
const router = express.Router();
const upload = require("../middlewares/Multer");
const validate = require("../validation/validate");
const { updateUserSchema } = require("../validation/user");

router.get("/admin/user/all", requireAdminLogin, userController.allusers_get);

router.post(
  "/admin/user/:userId/block/:blockStatus",
  requireAdminLogin,
  userController.blockUser_post
);
router.delete(
  "/admin/user/:userId/delete",
  requireAdminLogin,
  userController.deleteUser_delete
);

router.post(
  "/user/address/update",
  requireUserLogin,
  userController.updateUserAddress_post
);
router.get("/user/details", requireUserLogin, userController.getUser);

router.put(
  "/user/updateuser",
  requireUserLogin,
  validate(updateUserSchema),
  userController.updateUser
);

router.post(
  "/user/address/delete",
  requireUserLogin,
  userController.deleteAddress_patch
);

// Enhanced dashboard routes
router.get("/user/dashboard", requireUserLogin, userController.getUserDashboard);
router.get("/user/order/:orderId/invoice", requireUserLogin, userController.downloadInvoice);

module.exports = router;
