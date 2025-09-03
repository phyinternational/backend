const { z } = require("zod");

const brand = z.object({
  brand_name: z.string().nonempty(),
});

const createBrandSchema = z.object({
  body: brand,
});

const editBrandSchema = z.object({
  body: brand,
  params: z.object({
    id: z.string(),
  }),
});


module.exports = {
  createBrandSchema,
  editBrandSchema,
};