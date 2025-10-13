const mongoose = require("mongoose");
const Admin = mongoose.model("Admin");
const User = mongoose.model("User");
const User_Cart = mongoose.model("User_Cart");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const {
  errorRes,
  internalServerError,
  successRes,
} = require("../utility/index");
const catchAsync = require("../utility/catch-async");
const { User_Order } = require("../models/order.model");
const Product = require("../models/product.model");
const ProductCategory = require("../models/product_category.model");
const Constant = require("../models/constant.model");
const JWT_SECRET_ADMIN = process.env.JWT_SECRET_ADMIN;
const JWT_SECRET_USER = process.env.JWT_SECRET_USER;
const { ensureFirebaseAdmin } = require("../services/firebase-admin");

module.exports.adminSignup_post = catchAsync(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return errorRes(res, 400, "All fields are required.");

  try {
    const savedUser = await User.findOne({ email });
    if (savedUser)
      return errorRes(res, 400, "Use different email for admin account.");
  } catch (err) {
    console.log(err);
  }

  Admin.findOne({ email })
    .then((savedAdmin) => {
      if (savedAdmin) return errorRes(res, 400, "Admin already exist.");
      else {
        bcrypt.genSalt(10, (err, salt) => {
          if (err)
            return errorRes(
              res,
              400,
              "Internal server error. Please try again."
            );

          bcrypt
            .hash(password, salt)
            .then((hashedPass) => {
              const admin = new Admin({
                name,
                email,
                password: hashedPass,
              });
              admin
                .save()
                .then((admin) => {
                  const { _id, name, email } = admin;
                  const token = jwt.sign(
                    { _id, role: "admin" },
                    JWT_SECRET_ADMIN
                  );

                  return successRes(res, {
                    admin: { _id, name, email, token },
                    message: "Admin added successfully.",
                  });
                })
                .catch((err) => internalServerError(res, err));
            })
            .catch((err) => internalServerError(res, err));
        });
      }
    })
    .catch((err) => internalServerError(res, err));
});

module.exports.adminSignin_post = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return errorRes(res, 400, "All fields are required.");

  Admin.findOne({ email })
    .then((savedAdmin) => {
      if (!savedAdmin) return errorRes(res, 400, "Invalid login credentials.");
      bcrypt
        .compare(password, savedAdmin.password)
        .then((doMatch) => {
          if (!doMatch) return errorRes(res, 400, "Invalid login credentials.");
          const { _id, name, email } = savedAdmin;
          const token = jwt.sign({ _id, role: "admin" }, JWT_SECRET_ADMIN);

          return successRes(res, {
            admin: { _id, name, email, token },
            message: "Signin success.",
          });
        })
        .catch((err) => internalServerError(res, err));
    })
    .catch((err) => internalServerError(res, err));
};

module.exports.userSignup_post = catchAsync(async (req, res) => {
  const { name, email, password, phoneNumber } = req.body;

  if (!name || !email || !password || !phoneNumber) {
    return errorRes(res, 400, "All fields are required.");
  }

  const savedAdmin = await Admin.findOne({ email });
  if (savedAdmin) {
    return errorRes(res, 400, "Use a different email for the user account.");
  }

  // Check if the phone number is associated with a different account
  const savedNumber = await User.findOne({ phoneNumber });
  if (savedNumber) {
    return errorRes(
      res,
      400,
      "Given phone number is associated with a different account."
    );
  }

  // Check if the email is already used by a user
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return errorRes(res, 400, "User already registered with the given email.");
  }

  // Hash the password
  const hashedPass = await bcrypt.hash(password, 10);

  // Create a new user
  const user = new User({
    name,
    email,
    phoneNumber,
    password: hashedPass,
  });

  const savedUser = await user.save();

  // Create a new cart for the user
  const newCart = new User_Cart({
    userId: savedUser._id,
    products: [],
  });
  const cart = await newCart.save();

  // Update user's cart reference
  savedUser.cart = cart._id;
  await savedUser.save();

  const { _id, displayImage, accountType, shippingAddress } = savedUser;

  // Generate a JWT token
  const token = jwt.sign({ _id, role: "user" }, JWT_SECRET_USER);

  return successRes(res, {
    user: {
      _id,
      name,
      displayImage,
      email,
      phoneNumber,
      cart: cart._id,
      accountType,
      shippingAddress,
      token,
    },
    message: "User added successfully.",
  });
});

module.exports.userSignin_post = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return errorRes(res, 400, "All fields are required.");
  User.findOne({
    email,
  })
    .then((savedUser) => {
      if (!savedUser) return errorRes(res, 400, "Invalid login credentials.");
      bcrypt
        .compare(password, savedUser.password)
        .then((doMatch) => {
          if (!doMatch) return errorRes(res, 400, "Invalid login credentials.");
          else if (savedUser.isBlocked)
            return errorRes(res, 400, "User blocked by admin.");

          const {
            _id,
            name,
            contactNumber,
            displayImage,
            cart,
            shippingAddress,
            email,
            phoneNumber,
            accountType,
            coupon_applied,
            isBlocked,
          } = savedUser;
          const token = jwt.sign({ _id, role: "user" }, JWT_SECRET_USER);
          
          return successRes(res, {
            user: {
              _id,
              name,
              displayImage,
              email,
              contactNumber,
              accountType,
              phoneNumber,
              isBlocked,
              cart,
              coupon_applied,
              shippingAddress,
              token,
            },
            message: "Signin success.",
          });
        })
        .catch((err) => internalServerError(res, err));
    })
    .catch((err) => internalServerError(res, err));
};

// Verify Firebase ID token (from frontend phone OTP auth) and issue app JWT cookie
module.exports.firebaseLogin_post = catchAsync(async (req, res) => {
  const { idToken, displayName, email, phoneNumber, photoURL } = req.body || {};
  if (!idToken) return errorRes(res, 400, "Missing Firebase ID token.");

  const admin = ensureFirebaseAdmin();
  if (!admin || !admin.apps?.length) {
    return errorRes(
      res,
      500,
      "Auth service unavailable. Contact support (Firebase not configured)."
    );
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (e) {
    return errorRes(res, 401, "Invalid or expired Firebase ID token.");
  }

  const { uid, phone_number: firebasePhone, email: firebaseEmail, name } = decoded;

  // Find or create our local user
  let user = await User.findOne({ firebaseUid: uid });

  if (!user) {
    // Try to match by email or phone if present
    const query = [];
    if (firebaseEmail || email) query.push({ email: firebaseEmail || email });
    if (firebasePhone || phoneNumber) query.push({ phoneNumber: (firebasePhone || phoneNumber || '').replace(/[^0-9]/g, '') });

    if (query.length) {
      user = await User.findOne({ $or: query });
    }

    if (user) {
      user.firebaseUid = uid;
      if (!user.phoneNumber && (firebasePhone || phoneNumber)) {
        user.phoneNumber = String(firebasePhone || phoneNumber).replace(/[^0-9]/g, '');
      }
      if (!user.name && (displayName || name)) user.name = displayName || name;
      if (!user.email && (firebaseEmail || email)) user.email = (firebaseEmail || email).toLowerCase();
      if (!user.profileImageUrl && photoURL) user.profileImageUrl = photoURL;
      await user.save();
    } else {
      // Create new user with minimal fields
      user = new User({
        name: displayName || name || "",
        email: (firebaseEmail || email || `user_${uid}@placeholder.local`).toLowerCase(),
        phoneNumber: String(firebasePhone || phoneNumber || "").replace(/[^0-9]/g, ''),
        firebaseUid: uid,
      });

      // Ensure a cart exists
      const newCart = new User_Cart({ userId: user._id, products: [] });
      const cart = await newCart.save();
      user.cart = cart._id;
      await user.save();
    }
  }

  if (user.isBlocked) return errorRes(res, 403, "User blocked by admin.");

  const token = jwt.sign({ _id: user._id, role: "user" }, JWT_SECRET_USER);

  const {
    _id,
    name: uName,
    displayImage,
    cart,
    shippingAddress,
    email: uEmail,
    phoneNumber: uPhone,
    accountType,
    coupon_applied,
    isBlocked,
  } = user;

  return successRes(res, {
    user: {
      _id,
      name: uName,
      displayImage,
      email: uEmail,
      contactNumber: uPhone,
      accountType,
      phoneNumber: uPhone,
      isBlocked,
      cart,
      coupon_applied,
      shippingAddress,
      token,
    },
    message: "Signin success.",
  });
});

module.exports.dashboardData = catchAsync(async (req, res) => {
  const orderMetrics = [
    { title: "Total Orders", value: "0." },
    { title: "Complete Orders", value: "0" },
    { title: "Pending Orders", value: "0" },
    { title: "Canceled Orders", value: "0" },
  ];

  const otherMetrics = [
    { title: "Total Products", value: "0" },
    { title: "Total Users", value: "0" },
    { title: "Total Categories", value: "0" },
  ];

  const TotalOrders = await User_Order.countDocuments({});
  const CompleteOrders = await User_Order.countDocuments({
    order_status: "DELIVERED",
  });
  // Count orders that are neither delivered nor cancelled by admin (use enum value)
  const PendingOrders = await User_Order.countDocuments({
    order_status: { $nin: ["DELIVERED", "CANCELLED_BY_ADMIN"] },
  });

  const CanceledOrders = await User_Order.countDocuments({
    order_status: "CANCELLED_BY_ADMIN",
  });

  const TotalProducts = await Product.countDocuments();
  const TotalUsers = await User.countDocuments({});
  const TotalCategories = await ProductCategory.countDocuments({});

  orderMetrics[0].value = TotalOrders;
  orderMetrics[1].value = CompleteOrders;
  orderMetrics[2].value = PendingOrders;
  orderMetrics[3].value = CanceledOrders;

  otherMetrics[0].value = TotalProducts;
  otherMetrics[1].value = TotalUsers;
  otherMetrics[2].value = TotalCategories;

  return successRes(res, {
    orderMetrics,
    otherMetrics,
  });
});
module.exports.updateConstansts = catchAsync(async (req, res) => {
  const { constants } = req.body;
  if (!constants) return errorRes(res, 400, "No constants provided.");
   
  Array.from(constants).forEach(async (constant) => {
    const { name, value } = constant;
    await Constant.findOneAndUpdate(
      { name },
      { value },
      { new: true, upsert: true }
    );
  });

  return successRes(res, {
    message: "Constants updated successfully.",
  });
});

module.exports.getConstantData = catchAsync(async (req, res) => {
  const constants = await Constant.find({});

  return successRes(res, {
    constants,
  });
});

exports.getAdminData = (req, res) => {
  const userData = {
    id: req.admin.id,
    name: req.admin.name,
    email: req.admin.email,
    createdAt: req.admin.createdAt,
  };

  res.status(200).json({
    status: "success",
    userData,
  });
};

exports.getUserData = (req, res) => {
  const userData = {
    id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    createdAt: req.user.createdAt,
  };

  res.status(200).json({
    status: "success",
    userData,
  });
};

// Logout endpoints (client-side handles token removal from storage)
module.exports.userLogout_get = (req, res) => {
  return successRes(res, { message: "User logged out successfully." });
};

module.exports.adminLogout_get = (req, res) => {
  return successRes(res, { message: "Admin logged out successfully." });
};

module.exports.logoutAll_get = (req, res) => {
  return successRes(res, { message: "Logged out." });
};
