const mongoose = require("mongoose");
const Admin = mongoose.model("Admin");
const User = mongoose.model("User");
const jwt = require("jsonwebtoken");
const { errorRes } = require("../utility");
const JWT_SECRET_ADMIN = process.env.JWT_SECRET_ADMIN;
const JWT_SECRET_USER = process.env.JWT_SECRET_USER;

const extractBearer = (header) => {
  if (!header) return null;
  if (header.startsWith("Bearer ")) return header.split(" ")[1];
  return null;
};

const tryVerify = (token, secret) => {
  if (!token || !secret) return null;
  try {
    return jwt.verify(token, secret);
  } catch (e) {
    return null;
  }
};

module.exports.requireAdminLogin = (req, res, next) => {
  const token = extractBearer(req.headers.authorization);
  
  const payload = tryVerify(token, JWT_SECRET_ADMIN);
  if (!payload) return errorRes(res, 401, "Unauthorized access.");

  const { _id } = payload;
  Admin.findById(_id)
    .select("-password -__v")
    .then((admindata) => {
      req.admin = admindata;
      next();
    })
    .catch((err) => errorRes(res, 500, "Authorization error."));
};

module.exports.addUser = (req, res, next) => {
  const token = extractBearer(req.headers.authorization);

  const adminPayload = tryVerify(token, JWT_SECRET_ADMIN);
  if (adminPayload && !req.admin) req.admin = adminPayload;

  const userPayload = tryVerify(token, JWT_SECRET_USER);
  if (userPayload && !req.user) req.user = userPayload;

  // Proceed regardless of tokens being present; downstream handlers can enforce auth
  next();
};

module.exports.requireUserLogin = (req, res, next) => {
  const token = extractBearer(req.headers.authorization);

  const payload = tryVerify(token, JWT_SECRET_USER);
  if (!payload) return errorRes(res, 401, "Unauthorized access.");

  const { _id } = payload;
  User.findById(_id)
    .select("-password -__v")
    .then((userData) => {
      req.user = userData;
      next();
    })
    .catch((err) => errorRes(res, 500, "Authorization error."));
};
