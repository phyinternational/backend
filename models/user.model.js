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
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    phoneNumber: {
      type: Number,
      required: true,
    },
    password: {
      type: String,
      required: true,
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
    coupon_applied: [],
  },
  { timestamps: true }
);
mongoose.model("User", UserSchema);
module.exports = {User:mongoose.model("User")};