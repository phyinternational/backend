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
      enum: [
        "PLACED",
        "SHIPPED",
        "DELIVERED",
        "CANCELLED_BY_ADMIN",
        "CANCELLED_BY_USER",
        "RETURN_REQUESTED",
        "RETURN_APPROVED",
        "RETURN_REJECTED",
        "RETURNED",
        "REPLACEMENT_REQUESTED",
        "REPLACEMENT_APPROVED",
        "REPLACEMENT_REJECTED",
        "REPLACEMENT_IN_PROGRESS",
      ],
      required: true,
      default: "PLACED",
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    parent_order: {
      type: ObjectId,
      ref: "User_Order",
      default: null,
    },
    status_history: [
      {
        status: String,
        reason: String,
        updatedBy: {
          type: ObjectId,
          ref: "Admin",
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    cancellation: {
      reason: String,
      cancelledAt: Date,
    },
    return_request: {
      type: {
        reason: String,
        proof_images: [String],
        admin_comment: String,
        status: {
          type: String,
          enum: ["PENDING", "APPROVED", "REJECTED"],
        },
        requestedAt: Date,
        updatedAt: Date,
      },
      default: null,
    },
    replacement_request: {
      type: {
        reason: String,
        proof_images: [String],
        admin_comment: String,
        status: {
          type: String,
          enum: ["PENDING", "APPROVED", "REJECTED"],
        },
        requestedAt: Date,
        updatedAt: Date,
      },
      default: null,
    },
    // Item-level return requests (new schema for individual product returns)
    item_return_requests: [
      {
        product: {
          type: ObjectId,
          ref: "Product",
          required: true,
        },
        variant: {
          type: ObjectId,
          ref: "ProductVarient",
          default: null,
        },
        quantity: {
          type: Number,
          required: true,
          default: 1,
        },
        reason: {
          type: String,
          required: true,
        },
        proof_images: [String],
        admin_comment: String,
        status: {
          type: String,
          enum: ["PENDING", "APPROVED", "REJECTED"],
          required: true,
        },
        requestedAt: {
          type: Date,
          default: Date.now,
        },
        updatedAt: Date,
      },
    ],
    // Item-level replacement requests (new schema for individual product replacements)
    item_replacement_requests: [
      {
        product: {
          type: ObjectId,
          ref: "Product",
          required: true,
        },
        variant: {
          type: ObjectId,
          ref: "ProductVarient",
          default: null,
        },
        quantity: {
          type: Number,
          required: true,
          default: 1,
        },
        reason: {
          type: String,
          required: true,
        },
        proof_images: [String],
        admin_comment: String,
        status: {
          type: String,
          enum: ["PENDING", "APPROVED", "REJECTED"],
          required: true,
        },
        requestedAt: {
          type: Date,
          default: Date.now,
        },
        updatedAt: Date,
      },
    ],
    // Item-level cancellations (track which specific items are cancelled)
    cancelled_items: [
      {
        product: {
          type: ObjectId,
          ref: "Product",
          required: true,
        },
        variant: {
          type: ObjectId,
          ref: "ProductVarient",
          default: null,
        },
        quantity: {
          type: Number,
          required: true,
          default: 1,
        },
        reason: {
          type: String,
          required: true,
        },
        cancelledAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    cc_orderId: {
      type: String,
      // required: true,
    },
    cc_bankRefNo: {
      type: String,
      // required: true,
    },
    order_price: {
      type: Number,
      default: 0,
    },
    total_amount_paid: {
      type: Number,
      default: 0,
    },
    coupon_discount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Indexes for analytics performance
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ order_status: 1 });
OrderSchema.index({ payment_status: 1 });
OrderSchema.index({ buyer: 1 });
OrderSchema.index({ parent_order: 1 });
OrderSchema.index({ createdAt: -1, order_status: 1 });

// Virtual field for order total (sum of product price * quantity)
OrderSchema.virtual("orderTotal").get(function () {
  if (!this.products) return 0;
  return this.products.reduce((sum, item) => sum + item.price * item.quantity, 0);
});

mongoose.model("User_Order", OrderSchema);

module.exports.User_Order = mongoose.model("User_Order");