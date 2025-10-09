// const z = require("zod");

// const addShippingAddressSchema = z.object({
//     body: z.object({
//         userId: z.string().nonempty("User ID is required"),
//         firstName: z.string().nonempty("First name is required"),
//         lastName: z.string().optional(),
//         phone: z.string().nonempty("Phone number is required"),
//         addressLine1: z.string().nonempty("Address Line 1 is required"),
//         addressLine2: z.string().optional(),
//         city: z.string().nonempty("City is required"),
//         state: z.string().nonempty("State is required"),
//         postalCode: z.string().nonempty("Postal code is required"),
//         country: z.string().nonempty("Country is required"),
//     }),
// });

// const updateShippingAddressSchema = z.object({
//     body: z.object({
//         firstName: z.string().optional(),
//         lastName: z.string().optional(),
//         phone: z.string().optional(),
//         addressLine1: z.string().optional(),
//         addressLine2: z.string().optional(),
//         city: z.string().optional(),
//         state: z.string().optional(),
//         postalCode: z.string().optional(),
//         country: z.string().optional(),
//     }),
//     params: z.object({
//         id: z.string().nonempty("Shipping Address ID is required"),
//     }),
// });

// module.exports = {
//     addShippingAddressSchema,
//     updateShippingAddressSchema,
// };