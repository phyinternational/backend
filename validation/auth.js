import z from "zod";

export const SignupSchema = z.object({
  body: z.object({
    fullname: z.string().min(0, "First Name is required"),
    email: z.string().email("Email format is wrong"),
    password: z.string().min(8, "Minimum length is 8"),
  }),
});

export const OtpSchema = z.object({
  body: z.object({
    otp: z.string().min(6, "Minimum length is 6"),
    email: z.string().email("Email format is wrong"),
  }),
});
export const LoginSchema = z.object({
  body: z.object({
    email: z.string().email("Email format is wrong"),
    password: z.string().min(8, "Minimum length is 8"),
  }),
});
