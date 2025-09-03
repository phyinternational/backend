const { z } = require("zod");

const productRatingValidation = z.object({
  body: z.object({
    product: z.string().min(1).max(100),
    rating: z.number().int().min(1).max(5),
    reviewText: z.string().min(1).max(1000),
  }),
});

module.exports = productRatingValidation;
