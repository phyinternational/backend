const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;

const OrderSchema = mongoose.Schema(
  {
    buyer: {
      type: ObjectId,
      ref: "User",
      required: true,
    },
    products: [
      {
        product: {
          type: ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        variant: {
          type: ObjectId,
          ref: "ProductVarient",
          default: null,
        },
      },
    ],
    coupon_applied: {
      type: ObjectId,
      ref: "Coupon",
      default: null,
    },
    shippingAddress: {
      firstName: { type: String, default: "" },
      lastName: { type: String, default: "" },
      email: { type: String, default: "" },
      phoneNumber: { type: String, required: true },
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zip: { type: String, required: true },
      country: { type: String, default: "India" }
    },
    payment_mode: {
      type: String,
      enum: ["COD", "ONLINE"],
      required: true,
    },
    payment_status: {
      type: String,
      enum: ["PENDING", "COMPLETE", "FAILED"],
      required: true,
    },
    order_status: {
      type: String,
      enum: ["PLACED", "SHIPPED", "DELIVERED", "CANCELLED_BY_ADMIN"],
      required: true,
      default: "PLACED",
    },
    cc_orderId: {
      type: String,
      // required: true,
    },
    cc_bankRefNo: {
      type: String,
      // required: true,
    },
  },
  { timestamps: true }
);

mongoose.model("User_Order", OrderSchema);

module.exports.User_Order = mongoose.model("User_Order");