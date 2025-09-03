const z = require("zod");

const AddressSchema = z.object({
  firstName: z.string().nonempty(),
  lastName: z.string().default(""),
  country: z.string().default(""),
  email: z.string().default(""),
  street: z.string().default(""),
  city: z.string().default(""),
  state: z.string().default(""),
  suite: z.string().default(""),
  zip: z.string().min(6).max(6).default(""),
  phoneNumber: z.string().min(5),
});

const UserZodSchema = z
  .object({
    name: z.string().optional(),
    email: z.string().email().optional(),
    phoneNumber: z.number().optional(),
    profileImageUrl: z
      .string()
      .default(
        "https://res.cloudinary.com/piyush27/image/upload/v1632215188/story/Group_113_rufkkn.png"
      )
      .optional(),
    shippingAddress: AddressSchema.optional(),
  })
  .optional();

const updateUserSchema = z
  .object({
    body: UserZodSchema,
  })
  .partial();

module.exports = {
  updateUserSchema,
};
