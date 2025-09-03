const express = require("express");
const couponController = require("../controllers/coupon.controller");
const { requireAdminLogin } = require("../middlewares/requireLogin");
const router = express.Router();
const validate  = require("../validation/validate");
const { createCouponSchema } = require("../validation/coupon");

router.post(
  "/admin/coupon/add",
  requireAdminLogin,
  validate(createCouponSchema),
  couponController.addCoupon_post
);
router.get("/coupon/:code/get", couponController.getParticularCoupon_get);

router.delete(
  "/admin/coupon/:_id/delete",
  requireAdminLogin,
  couponController.deleteCoupon_delete
);
router.post(
  "/admin/coupon/:_id/edit",
  requireAdminLogin,
  couponController.editCoupons_post
);

router.get("/coupon/all", couponController.getAllCoupons_get);
router.get('/coupon/single/:id', couponController.getSinbleById_get)

module.exports = router;
