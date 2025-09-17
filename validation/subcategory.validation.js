const { z } = require("zod");
const mongoose = require("mongoose");

// Custom ObjectId validation
const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: "Invalid ObjectId format"
});

// Validation for adding a new subcategory
const addSubcategoryValidation = z.object({
  name: z.string()
    .min(2, "Name must be at least 2 characters long")
    .max(100, "Name must not exceed 100 characters")
    .trim(),

  slug: z.string()
    .min(2, "Slug must be at least 2 characters long")
    .max(100, "Slug must not exceed 100 characters")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
    .optional(),

  description: z.string()
    .max(500, "Description must not exceed 500 characters")
    .optional()
    .default(""),

  parentCategory: objectIdSchema,

  imageUrl: z.string()
    .url("Image URL must be a valid URL")
    .optional()
    .or(z.literal("")),

  seoTitle: z.string()
    .max(60, "SEO title must not exceed 60 characters")
    .optional()
    .default(""),

  seoDescription: z.string()
    .max(160, "SEO description must not exceed 160 characters")
    .optional()
    .default(""),

  sortOrder: z.number()
    .int("Sort order must be an integer")
    .min(0, "Sort order must be a positive number")
    .optional()
    .default(0)
});

// Validation for updating a subcategory
const updateSubcategoryValidation = z.object({
  name: z.string()
    .min(2, "Name must be at least 2 characters long")
    .max(100, "Name must not exceed 100 characters")
    .trim()
    .optional(),

  slug: z.string()
    .min(2, "Slug must be at least 2 characters long")
    .max(100, "Slug must not exceed 100 characters")
    .regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
    .optional(),

  description: z.string()
    .max(500, "Description must not exceed 500 characters")
    .optional(),

  parentCategory: objectIdSchema.optional(),

  imageUrl: z.string()
    .url("Image URL must be a valid URL")
    .optional()
    .or(z.literal("")),

  isActive: z.boolean()
    .optional(),

  seoTitle: z.string()
    .max(60, "SEO title must not exceed 60 characters")
    .optional(),

  seoDescription: z.string()
    .max(160, "SEO description must not exceed 160 characters")
    .optional(),

  sortOrder: z.number()
    .int("Sort order must be an integer")
    .min(0, "Sort order must be a positive number")
    .optional()
});

// Validation for sort order update
const sortOrderValidation = z.object({
  subcategories: z.array(
    z.object({
      id: objectIdSchema,
      sortOrder: z.number()
        .int("Sort order must be an integer")
        .min(0, "Sort order must be a positive number")
    })
  ).min(1, "At least one subcategory is required")
});

// Validation for query parameters
const queryValidation = z.object({
  parentCategory: objectIdSchema.optional(),

  isActive: z.enum(["true", "false"])
    .optional(),

  search: z.string()
    .max(100, "Search term must not exceed 100 characters")
    .trim()
    .optional(),

  page: z.string()
    .regex(/^\d+$/, "Page must be a number")
    .transform((val) => parseInt(val))
    .refine((val) => val >= 1, "Page must be at least 1")
    .optional(),

  limit: z.string()
    .regex(/^\d+$/, "Limit must be a number")
    .transform((val) => parseInt(val))
    .refine((val) => val >= 1 && val <= 100, "Limit must be between 1 and 100")
    .optional(),

  sort: z.enum(["name", "-name", "createdAt", "-createdAt", "sortOrder", "-sortOrder"])
    .optional()
});

// Validation middleware
const validateAddSubcategory = (req, res, next) => {
  try {
    const validatedData = addSubcategoryValidation.parse(req.body);
    req.body = validatedData;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));

      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors
      });
    }
    next(error);
  }
};

const validateUpdateSubcategory = (req, res, next) => {
  try {
    const validatedData = updateSubcategoryValidation.parse(req.body);
    req.body = validatedData;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));

      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors
      });
    }
    next(error);
  }
};

const validateSortOrder = (req, res, next) => {
  try {
    const validatedData = sortOrderValidation.parse(req.body);
    req.body = validatedData;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));

      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors
      });
    }
    next(error);
  }
};

const validateQuery = (req, res, next) => {
  try {
    const validatedData = queryValidation.parse(req.query);
    req.query = validatedData;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));

      return res.status(400).json({
        success: false,
        message: "Query validation error",
        errors
      });
    }
    next(error);
  }
};

module.exports = {
  addSubcategoryValidation,
  updateSubcategoryValidation,
  sortOrderValidation,
  queryValidation,
  validateAddSubcategory,
  validateUpdateSubcategory,
  validateSortOrder,
  validateQuery
};