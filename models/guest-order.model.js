const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;

const guestOrderSchema = new mongoose.Schema({
  guestInfo: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phoneNumber: { type: String, required: true },
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
      priceBreakdown: {
        silverCost: Number,
        laborCost: Number,
        gstAmount: Number,
        finalPrice: Number
      }
    },
  ],
  shippingAddress: {
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    country: { type: String, default: "India" }
  },
  billingAddress: {
    address: String,
    city: String,
    state: String,
    pincode: String,
    country: { type: String, default: "India" },
    sameAsShipping: { type: Boolean, default: true }
  },
  orderTotal: {
    subtotal: { type: Number, required: true },
    gstAmount: { type: Number, required: true },
    shippingCharges: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    finalAmount: { type: Number, required: true }
  },
  paymentInfo: {
    method: {
      type: String,
      enum: ["ONLINE", "COD"],
      required: true
    },
    status: {
      type: String,
      enum: ["PENDING", "COMPLETED", "FAILED", "REFUNDED"],
      default: "PENDING"
    },
    transactionId: String,
    gateway: String, // razorpay, stripe, etc.
    paidAt: Date
  },
  orderStatus: {
    type: String,
    enum: ["PLACED", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"],
    default: "PLACED"
  },
  couponApplied: {
    type: ObjectId,
    ref: "Coupon",
    default: null
  },
  convertedToUser: {
    type: ObjectId,
    ref: "User",
    default: null
  },
  conversionToken: {
    type: String, // Token sent via email for account creation
    expires: Date
  },
  notes: String,
  trackingNumber: String,
  estimatedDelivery: Date,
  
  // Audit fields
  ipAddress: String,
  userAgent: String,
  orderSource: {
    type: String,
    enum: ["WEB", "MOBILE", "ADMIN"],
    default: "WEB"
  }
}, {
  timestamps: true
});

// Index for faster queries
guestOrderSchema.index({ "guestInfo.email": 1 });
guestOrderSchema.index({ "guestInfo.phoneNumber": 1 });
guestOrderSchema.index({ orderStatus: 1 });
guestOrderSchema.index({ "paymentInfo.status": 1 });
guestOrderSchema.index({ createdAt: -1 });

// Method to convert guest order to user order
guestOrderSchema.methods.convertToUserOrder = async function(userId) {
  const User_Order = require("./order.model").User_Order;
  
  const userOrder = new User_Order({
    buyer: userId,
    products: this.products,
    order_price: this.orderTotal.finalAmount.toString(),
    shippingAddress: {
      address: `${this.shippingAddress.address}, ${this.shippingAddress.city}, ${this.shippingAddress.state}`,
      pincode: parseInt(this.shippingAddress.pincode)
    },
    payment_mode: this.paymentInfo.method,
    payment_status: this.paymentInfo.status === "COMPLETED" ? "COMPLETE" : this.paymentInfo.status,
    order_status: this.orderStatus === "DELIVERED" ? "DELIVERED" : "PLACED",
    coupon_applied: this.couponApplied,
    // Copy other relevant fields
  });

  const savedOrder = await userOrder.save();
  
  // Mark this guest order as converted
  this.convertedToUser = userId;
  await this.save();
  
  return savedOrder;
};

const GuestOrder = mongoose.model("GuestOrder", guestOrderSchema);
module.exports = GuestOrder;
