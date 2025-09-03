const { z } = require("zod");

const ItemSchemaZod = z.object({
  productId: z.string(),
  quantity: z.number().int().positive(),
  varientId: z.string(),
});

// Define a Zod schema for the cartSchema
const cartSchemaZod = z.object({
  products: z.array(ItemSchemaZod),
});

const upsertCartSchema = z.object({
  body: cartSchemaZod,
});

const postCartItem = z.object({
  body: ItemSchemaZod,
});

const deleteCartItem = z.object({
  body: z.object({
    productId: z.string(),
    varientId: z.string(),
  }),
});

module.exports = {
  upsertCartSchema,
  postCartItem,
  deleteCartItem,
};
