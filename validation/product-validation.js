const { z } = require("zod");


module.exports.addproductVariantSchema = z.object({
  body: z.object({
    productId: z.string().regex(/^[0-9a-fA-F]{24}$/), // Validate as Mongoose ObjectId
    size: z.string().min(1),
    price: z.number().min(0),
    salePrice: z.number().optional(),
    stock: z.number().min(0),
    color: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/)
      .optional(), // Optional Mongoose ObjectId
    images: z.array(z.string()).optional(),
  }),
});
