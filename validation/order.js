const z = require("zod");
// Custom validation for MongoDB ObjectId
const ObjectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

// Product item within an order
const ProductItemSchema = z.object({
  product: ObjectIdSchema,
  quantity: z.number(),
  variant: ObjectIdSchema.optional().default(""),
});

// Shipping address for an order
const ShippingAddressSchema = z.object({
  address: z.string().optional(),
  pincode: z.number().optional(),
});

// Enums for payment mode, payment status, and order status
const PaymentModeEnum = z.enum(["COD", "ONLINE"]);
const PaymentStatusEnum = z.enum(["PENDING", "COMPLETE", "FAILED"]);
const OrderStatusEnum = z.enum([
  "PLACED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED BY ADMIN",
]);

// The complete order schema
const OrderSchema = z.object({
  products: z.array(ProductItemSchema),
  coupon_applied: ObjectIdSchema.optional().nullable(),
  shippingAddress: ShippingAddressSchema,
  payment_mode: PaymentModeEnum,
  payment_status: PaymentStatusEnum,
  order_status: OrderStatusEnum.default("PLACED"),
  cc_orderId: z.string().optional(),
  cc_bankRefNo: z.string().optional(),
});

const placeOrderValidation = z.object({
  body: OrderSchema,
});

module.exports = {
  placeOrderValidation,
};
