const { z } = require("zod");

const couponSchema = z.object({
  couponCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, { message: "Coupon code is required" })
    .regex(/^[A-Z0-9]+$/, {
      message: "Coupon code must be alphanumeric and uppercase",
    }),
  couponAmount: z
    .number()
    .min(0, { message: "Coupon amount must be positive" }),
  couponType: z.enum(["INR", "PERCENTAGE"], { message: "Invalid coupon type" }),
  couponQuantity: z
    .number()
    .min(1, { message: "Coupon quantity must be at least 1" }),
  minCartAmount: z
    .number()
    .min(0, { message: "Minimum cart amount must be positive" }),
  expiryDate: z.string().refine((date) => new Date(date) > new Date(), {
    message: "Expiry date must be in the future",
  }),
});

const createCouponSchema = z.object({
  body: couponSchema,
});
module.exports = { createCouponSchema };
