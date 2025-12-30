import Joi from "joi";

export const createBrandSchema = Joi.object({
  name: Joi.string()
    .required()
    .min(1)
    .max(100)
    .trim()
    .messages({
      "string.empty": "Brand name is required",
      "string.min": "Brand name must be at least 1 character long",
      "string.max": "Brand name cannot exceed 100 characters",
      "any.required": "Brand name is required",
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

export const updateBrandSchema = Joi.object({
  name: Joi.string()
    .optional()
    .min(1)
    .max(100)
    .trim()
    .messages({
      "string.min": "Brand name must be at least 1 character long",
      "string.max": "Brand name cannot exceed 100 characters",
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







