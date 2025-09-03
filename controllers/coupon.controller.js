const mongoose = require("mongoose");
const { errorRes, successRes, internalServerError } = require("../utility");
const Coupon = require("../models/coupon.model");
const catchAsync = require("../utility/catch-async");

module.exports.addCoupon_post = catchAsync(async (req, res) => {
  const { couponCode } = req.body;
  const couponExist = await Coupon.findOne({ couponCode });
  if (couponExist) return errorRes(res, 400, "Coupon code already exist.");

  const coupon = await Coupon.create(req.body);
  if (!coupon) return errorRes(res, 400, "Coupon not added.");

  successRes(res, { coupon, message: "Coupon added successfully." });
});

module.exports.deleteCoupon_delete = catchAsync(async (req, res) => {
  const { _id } = req.params;
  if (!_id) return errorRes(res, 400, "Coupon Id is required.");

  const deletedCoupon = await Coupon.findByIdAndDelete(_id);
  if (!deletedCoupon) return errorRes(res, 400, "Coupon does not exist.");

  successRes(res, {
    deletedCoupon,
    message: "Coupon deleted successfully.",
  });
});

module.exports.editCoupons_post = catchAsync(async (req, res) => {
  const { _id } = req.params;
  const coupon = req.body;

  const updatedCoupon = await Coupon.findByIdAndUpdate(_id, coupon, {
    new: true,
    runValidators: true,
  });
  if (!updatedCoupon) return errorRes(res, 404, "Coupon does not exist.");

  successRes(res, {
    updatedCoupon,
    message: "Coupon updated successfully.",
  });
});

module.exports.getAllCoupons_get = catchAsync(async (req, res) => {
  const coupons = await Coupon.find();
  return res.status(200).json({ coupons });
});

module.exports.getParticularCoupon_get = (req, res) => {
  const { code } = req.params;
  Coupon.findOne({ code: { $regex: new RegExp(code, "i") } })
    .then((coupon) => {
      if (!coupon) return errorRes(res, 400, "Invalid coupon code.");
      return successRes(res, { coupon });
    })
    .catch((err) => internalServerError(res, err));
};

module.exports.getSinbleById_get = (req, res) => {
  const { id } = req.params;
  Coupon.findById(id)
    .then((coupon) => {
      if (!coupon) return errorRes(res, 400, "Invalid coupon code.");
      return successRes(res, { coupon });
    })
    .catch((err) => internalServerError(res, err));
};
