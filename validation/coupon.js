const { z } = require("zod");

const couponSchema = z.object({
  couponCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, { message: "Coupon code must be at least 3 characters" })
    .max(20, { message: "Coupon code must be at most 20 characters" })
    .regex(/^[A-Z0-9]+$/, {
      message: "Coupon code must be alphanumeric and uppercase",
    }),
  couponAmount: z
    .number()
    .min(0.01, { message: "Coupon amount must be greater than 0" }),
  couponType: z.enum(["INR", "PERCENTAGE"], { message: "Invalid coupon type" }),
  couponQuantity: z
    .number()
    .int()
    .min(1, { message: "Coupon quantity must be at least 1" })
    .max(10000, { message: "Coupon quantity cannot exceed 10,000" }),
  minCartAmount: z
    .number()
    .min(0, { message: "Minimum cart amount must be positive" }),
  maxDiscountAmount: z
    .number()
    .min(0, { message: "Maximum discount amount must be positive" })
    .optional()
    .nullable(),
  expiryDate: z.string().refine((date) => {
    const expiryDate = new Date(date);
    const now = new Date();
    const maxDate = new Date();
    maxDate.setFullYear(maxDate.getFullYear() + 2); // Max 2 years from now
    
    return expiryDate > now && expiryDate <= maxDate;
  }, {
    message: "Expiry date must be between tomorrow and 2 years from now",
  }),
  isActive: z.boolean().optional().default(true),
  usagePerUser: z
    .number()
    .int()
    .min(1, { message: "Usage per user must be at least 1" })
    .max(10, { message: "Usage per user cannot exceed 10" })
    .optional()
    .default(1),
  applicableCategories: z.array(z.string()).optional().default([]),
  excludeCategories: z.array(z.string()).optional().default([]),
  description: z.string().trim().max(500, { message: "Description too long" }).optional(),
});

// Additional validation for percentage coupons
const createCouponSchema = z.object({
  body: couponSchema.refine((data) => {
    if (data.couponType === 'PERCENTAGE') {
      return data.couponAmount <= 100;
    }
    return true;
  }, {
    message: "Percentage discount cannot exceed 100%",
    path: ['couponAmount']
  }).refine((data) => {
    if (data.couponType === 'PERCENTAGE' && data.couponAmount > 50) {
      return data.maxDiscountAmount !== undefined && data.maxDiscountAmount > 0;
    }
    return true;
  }, {
    message: "High percentage discounts (>50%) must have a maximum discount limit",
    path: ['maxDiscountAmount']
  })
});

const updateCouponSchema = z.object({
  body: couponSchema.partial().refine((data) => {
    if (data.couponType === 'PERCENTAGE' && data.couponAmount) {
      return data.couponAmount <= 100;
    }
    return true;
  }, {
    message: "Percentage discount cannot exceed 100%",
    path: ['couponAmount']
  })
});

const applyCouponSchema = z.object({
  body: z.object({
    couponCode: z.string().trim().min(1, { message: "Coupon code is required" }),
    cartAmount: z.number().min(0, { message: "Cart amount must be positive" }),
    cartItems: z.array(z.object({
      productId: z.string().optional(),
      categoryId: z.string().optional(),
      quantity: z.number().optional(),
      price: z.number().optional()
    })).optional().default([]),
    userId: z.string().optional() // For guest checkout
  })
});

const validateCouponSchema = z.object({
  body: z.object({
    couponCode: z.string().trim().min(1, { message: "Coupon code is required" }),
    cartAmount: z.number().min(0, { message: "Cart amount must be positive" }),
    cartItems: z.array(z.object({
      productId: z.string().optional(),
      categoryId: z.string().optional(),
      quantity: z.number().optional(),
      price: z.number().optional()
    })).optional().default([])
  })
});

const bulkUpdateSchema = z.object({
  body: z.object({
    couponIds: z.array(z.string()).min(1, { message: "At least one coupon ID required" }),
    updateData: z.object({
      isActive: z.boolean().optional(),
      expiryDate: z.string().optional(),
      couponQuantity: z.number().min(1).optional(),
      description: z.string().optional()
    }).optional()
  })
});

const bulkToggleSchema = z.object({
  body: z.object({
    couponIds: z.array(z.string()).min(1, { message: "At least one coupon ID required" }),
    isActive: z.boolean({ message: "isActive must be a boolean" })
  })
});

const duplicateCouponSchema = z.object({
  body: z.object({
    newCouponCode: z.string().trim().min(3, { message: "New coupon code must be at least 3 characters" }),
    modifications: z.object({
      couponAmount: z.number().min(0).optional(),
      couponQuantity: z.number().min(1).optional(),
      minCartAmount: z.number().min(0).optional(),
      expiryDate: z.string().optional(),
      description: z.string().optional()
    }).optional()
  })
});

module.exports = { 
  createCouponSchema, 
  updateCouponSchema, 
  applyCouponSchema,
  validateCouponSchema,
  bulkUpdateSchema,
  bulkToggleSchema,
  duplicateCouponSchema
};
