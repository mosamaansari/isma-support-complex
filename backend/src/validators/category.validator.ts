import Joi from "joi";

export const createCategorySchema = Joi.object({
  name: Joi.string()
    .required()
    .min(1)
    .max(100)
    .trim()
    .messages({
      "string.empty": "Category name is required",
      "string.min": "Category name must be at least 1 character long",
      "string.max": "Category name cannot exceed 100 characters",
      "any.required": "Category name is required",
    }),
  description: Joi.string()
    .optional()
    .allow("", null)
    .max(500)
    .trim()
    .messages({
      "string.max": "Description cannot exceed 500 characters",
    }),
});

export const updateCategorySchema = Joi.object({
  name: Joi.string()
    .optional()
    .min(1)
    .max(100)
    .trim()
    .messages({
      "string.min": "Category name must be at least 1 character long",
      "string.max": "Category name cannot exceed 100 characters",
    }),
  description: Joi.string()
    .optional()
    .allow("", null)
    .max(500)
    .trim()
    .messages({
      "string.max": "Description cannot exceed 500 characters",
    }),
});


