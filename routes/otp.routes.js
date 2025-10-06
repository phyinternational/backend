const express = require("express");
const router = express.Router();
const otpController = require("../controllers/otp.controller");

// OTP Authentication Routes
router.post("/auth/send-otp", otpController.sendOTP_post);
router.post("/auth/verify-otp", otpController.verifyOTP_post);
router.post("/auth/resend-otp", otpController.resendOTP_post);

module.exports = router;
