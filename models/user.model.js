const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;

const addressSchema = new mongoose.Schema({
  firstName: { type: String, default: "" },
  lastName: { type: String, default: "" },
  country: { type: String, default: "" },
  email: { type: String, default: "" },
  street: { type: String, default: "" },
  city: { type: String, default: "" },
  state: { type: String, default: "" },
  suite: { type: String, default: "" },
  zip: { type: String, default: "" },
  phoneNumber: { type: String, required: true }, // Making phone number required
});
const UserSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: false, // Optional - collected during onboarding
    },
    email: {
      type: String,
      required: false, // Optional - can be added later
      unique: true,
      sparse: true, // Allow multiple null values for unique index
      lowercase: true,
    },
    phoneNumber: {
      type: String, // Changed from Number to String for international format
      required: true,
      unique: true,
      index: true,
    },
    // For traditional email/password authentication
    password: {
      type: String,
      required: function requiredPassword() {
        // Password required only if using email/password auth (not OTP or Firebase)
        return !this.firebaseUid && !this.isPhoneVerified;
      },
    },
    // Firebase UID for users authenticated via Firebase (e.g., phone OTP)
    firebaseUid: {
      type: String,
      index: true,
      sparse: true,
    },
    // Phone verification status for OTP-based auth
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    // Onboarding completion status
    isOnboarded: {
      type: Boolean,
      default: false,
    },
    profileImageUrl: {
      type: String,
      default:
        "https://res.cloudinary.com/piyush27/image/upload/v1632215188/story/Group_113_rufkkn.png",
    },
    shippingAddress: addressSchema,
    isBlocked: {
      type: Boolean,
      required: true,
      default: false,
    },
      accountType: {
      type: String,
      default: "user",
    },
      cart: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User_Cart",
        default: null
      },
    coupon_applied: [],
  },
  { timestamps: true }
);
mongoose.model("User", UserSchema);
module.exports = {User:mongoose.model("User")};