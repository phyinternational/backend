const express = require("express");
const couponController = require("../controllers/coupon.controller");
const { requireAdminLogin, requireUserLogin } = require("../middlewares/requireLogin");
const router = express.Router();
const validate  = require("../validation/validate");
const { 
  createCouponSchema, 
  applyCouponSchema, 
  validateCouponSchema,
  bulkUpdateSchema,
  bulkToggleSchema,
  duplicateCouponSchema
} = require("../validation/coupon");

// ========== ADMIN ROUTES ==========
router.post(
  "/admin/coupon/add",
  requireAdminLogin,
  validate(createCouponSchema),
  couponController.addCoupon_post
);

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

router.get("/admin/coupon/all", requireAdminLogin, couponController.getAllCoupons_get);

router.post(
  "/admin/coupon/bulk-update", 
  requireAdminLogin, 
  validate(bulkUpdateSchema),
  couponController.bulkUpdateCoupons_post
);

router.post(
  "/admin/coupon/bulk-toggle", 
  requireAdminLogin, 
  validate(bulkToggleSchema),
  couponController.bulkToggleCoupons_post
);

router.get("/admin/coupon/analytics", requireAdminLogin, couponController.getCouponAnalytics_get);

router.get(
  "/admin/coupon/analytics/detailed", 
  requireAdminLogin, 
  couponController.getDetailedCouponAnalytics_get
);

router.get(
  "/admin/coupon/expiring", 
  requireAdminLogin, 
  couponController.getExpiringCoupons_get
);

router.post(
  "/admin/coupon/:id/duplicate",
  requireAdminLogin,
  validate(duplicateCouponSchema),
  couponController.duplicateCoupon_post
);

// ========== USER ROUTES ==========
router.get("/coupon/:code/get", couponController.getParticularCoupon_get);

router.get('/coupon/single/:id', couponController.getSingleById_get);

router.post(
  "/coupon/apply", 
  validate(applyCouponSchema), 
  requireUserLogin, 
  couponController.applyCoupon_post
);

router.post(
  "/coupon/validate", 
  validate(validateCouponSchema), 
  requireUserLogin, 
  couponController.validateCouponForCart_post
);

router.get(
  "/user/coupons/available",
  requireUserLogin,
  couponController.getAvailableCoupons_get
);

router.get(
  "/user/coupons/history",
  requireUserLogin,
  couponController.getUserCouponHistory_get
);

// ========== PUBLIC ROUTES ==========
router.get("/coupon/all", couponController.getAllCoupons_get);

module.exports = router;
