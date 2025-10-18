const mongoose = require("mongoose");
const User = mongoose.model("User");
const User_Cart = mongoose.model("User_Cart");
const jwt = require("jsonwebtoken");
const { errorRes, successRes } = require("../utility/index");
const catchAsync = require("../utility/catch-async");
const otpService = require("../services/otp.service");

const JWT_SECRET_USER = process.env.JWT_SECRET_USER;

// In-memory store for OTP attempts and cooldowns (use Redis in production)
const otpAttempts = new Map(); // phoneNumber -> { count, lastAttempt }
const otpSessions = new Map(); // phoneNumber -> { otp, sessionId, expiresAt }

// Configuration
const OTP_EXPIRY_MINUTES = 10;
const MAX_OTP_ATTEMPTS = 5;
const OTP_COOLDOWN_SECONDS = 60; // 1 minute between OTP requests

/**
 * Send OTP to user's phone number
 * POST /auth/send-otp
 * Body: { phoneNumber: string }
 */
module.exports.sendOTP_post = catchAsync(async (req, res) => {
  const { phoneNumber } = req.body;

  // Validate phone number
  if (!phoneNumber) {
    return errorRes(res, 400, "Phone number is required");
  }

  // Format phone number
  const formattedPhone = otpService.formatPhoneNumber(phoneNumber);

  // Check cooldown period
  const attemptData = otpAttempts.get(formattedPhone);
  if (attemptData) {
    const timeSinceLastAttempt = Date.now() - attemptData.lastAttempt;
    const cooldownRemaining = OTP_COOLDOWN_SECONDS * 1000 - timeSinceLastAttempt;
    
    if (cooldownRemaining > 0) {
      const secondsRemaining = Math.ceil(cooldownRemaining / 1000);
      return errorRes(
        res,
        429,
        `Please wait ${secondsRemaining} seconds before requesting another OTP`
      );
    }

    // Check max attempts
    if (attemptData.count >= MAX_OTP_ATTEMPTS) {
      return errorRes(
        res,
        429,
        "Maximum OTP attempts exceeded. Please try again after 1 hour."
      );
    }
  }

  try {
    // Send OTP via 2Factor
    const otpResult = await otpService.sendOTP(formattedPhone);

    if (!otpResult.success) {
      return errorRes(res, 500, otpResult.message || "Failed to send OTP");
    }

    // Store OTP session (in production, use Redis with TTL)
    otpSessions.set(formattedPhone, {
      otp: otpResult.otp,
      sessionId: otpResult.sessionId,
      expiresAt: Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
    });

    // Update attempt tracking
    const currentAttempts = attemptData?.count || 0;
    otpAttempts.set(formattedPhone, {
      count: currentAttempts + 1,
      lastAttempt: Date.now(),
    });

    // Clear attempt data after 1 hour
    setTimeout(() => {
      otpAttempts.delete(formattedPhone);
    }, 60 * 60 * 1000);

    // Return success (don't send OTP in production!)
    return successRes(res, {
      message: "OTP sent successfully",
      sessionId: otpResult.sessionId,
      expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
      // For development only - remove in production!
      ...(process.env.NODE_ENV !== "production" && { otp: otpResult.otp }),
    });
  } catch (error) {
    console.error("Error in sendOTP_post:", error);
    return errorRes(res, 500, error.message || "Failed to send OTP");
  }
});

/**
 * Verify OTP and create/login user
 * POST /auth/verify-otp
 * Body: { phoneNumber: string, otp: string }
 */
module.exports.verifyOTP_post = catchAsync(async (req, res) => {
  const { phoneNumber, otp } = req.body;

  // Validate input
  if (!phoneNumber || !otp) {
    return errorRes(res, 400, "Phone number and OTP are required");
  }

  // Format phone number
  const formattedPhone = otpService.formatPhoneNumber(phoneNumber);

  // Check if OTP session exists
  const session = otpSessions.get(formattedPhone);
  if (!session) {
    return errorRes(res, 400, "No OTP session found. Please request a new OTP.");
  }

  // Check if OTP expired
  if (Date.now() > session.expiresAt) {
    otpSessions.delete(formattedPhone);
    return errorRes(res, 400, "OTP has expired. Please request a new OTP.");
  }

  try {
    // Verify OTP with 2Factor
    const verificationResult = await otpService.verifyOTP(formattedPhone, otp);

    if (!verificationResult.success) {
      return errorRes(res, 400, verificationResult.message || "Invalid OTP");
    }

    // OTP verified successfully - clear session
    otpSessions.delete(formattedPhone);
    otpAttempts.delete(formattedPhone);

    // Find or create user
    let user = await User.findOne({ phoneNumber: formattedPhone });

    if (!user) {
      // Create new user with phone number only
      user = new User({
        phoneNumber: formattedPhone,
        isPhoneVerified: true,
        isOnboarded: false,
        shippingAddress: {
          phoneNumber: formattedPhone
        },
      });

      // Create cart for new user - handle potential duplicate key error
      try {
        const newCart = new User_Cart({
          userId: user._id,
          products: [],
        });
        const cart = await newCart.save();
        user.cart = cart._id;
      } catch (cartError) {
        // If cart creation fails due to duplicate key error, try to find existing cart
        if (cartError.code === 11000) {
          console.log('Cart duplicate key error, attempting to find existing cart for user');
          const existingCart = await User_Cart.findOne({ userId: user._id });
          if (existingCart) {
            user.cart = existingCart._id;
          } else {
            // If no existing cart found, this is a different issue
            throw cartError;
          }
        } else {
          throw cartError;
        }
      }
      
      await user.save();
    } else {
      // Update existing user
      if (!user.isPhoneVerified) {
        user.isPhoneVerified = true;
        await user.save();
      }

      // Check if user is blocked
      if (user.isBlocked) {
        return errorRes(res, 403, "User account is blocked by admin");
      }

      // Ensure user has a cart (create if missing)
      if (!user.cart) {
        try {
          const newCart = new User_Cart({
            userId: user._id,
            products: [],
          });
          const cart = await newCart.save();
          user.cart = cart._id;
          await user.save();
        } catch (cartError) {
          if (cartError.code === 11000) {
            const existingCart = await User_Cart.findOne({ userId: user._id });
            if (existingCart) {
              user.cart = existingCart._id;
              await user.save();
            }
          }
        }
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { _id: user._id, role: "user" },
      JWT_SECRET_USER,
      { expiresIn: "30d" } // Token valid for 30 days
    );

    // Prepare user response
    const {
      _id,
      name,
      email,
      phoneNumber: phone,
      profileImageUrl,
      cart,
      shippingAddress,
      accountType,
      isOnboarded,
      isPhoneVerified,
      coupon_applied,
      isBlocked,
    } = user;

    return successRes(res, {
      user: {
        _id,
        name: name || null,
        email: email || null,
        phoneNumber: phone,
        profileImageUrl,
        cart,
        shippingAddress: shippingAddress || null,
        accountType,
        isOnboarded,
        isPhoneVerified,
        coupon_applied,
        isBlocked,
        token,
      },
      message: user.isOnboarded
        ? "Login successful"
        : "Login successful. Please complete your profile.",
    });
  } catch (error) {
    console.error("Error in verifyOTP_post:", error);
    return errorRes(res, 500, error.message || "Failed to verify OTP");
  }
});

/**
 * Resend OTP (same as sendOTP but with different messaging)
 * POST /auth/resend-otp
 * Body: { phoneNumber: string }
 */
module.exports.resendOTP_post = catchAsync(async (req, res) => {
  // Reuse sendOTP logic
  return module.exports.sendOTP_post(req, res);
});
