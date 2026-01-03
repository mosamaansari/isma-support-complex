import Joi from "joi";

export const createRoleSchema = Joi.object({
  name: Joi.string()
    .required()
    .min(1)
    .max(50)
    .pattern(/^[a-z][a-z0-9_]*$/)
    .trim()
    .messages({
      "string.empty": "Role name is required",
      "string.min": "Role name must be at least 1 character long",
      "string.max": "Role name cannot exceed 50 characters",
      "string.pattern.base": "Role name must be lowercase, start with a letter, and can contain underscores",
      "any.required": "Role name is required",
    }),
  label: Joi.string()
    .required()
    .min(1)
    .max(255)
    .trim()
    .messages({
      "string.empty": "Role label is required",
      "string.min": "Role label must be at least 1 character long",
      "string.max": "Role label cannot exceed 255 characters",
      "any.required": "Role label is required",
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

export const updateRoleSchema = Joi.object({
  label: Joi.string()
    .optional()
    .min(1)
    .max(255)
    .trim()
    .messages({
      "string.min": "Role label must be at least 1 character long",
      "string.max": "Role label cannot exceed 255 characters",
    }),
  description: Joi.string()
    .optional()
    .allow("", null)
    .max(500)
    .trim()
    .messages({
      "string.max": "Description cannot exceed 500 characters",
    }),
  isActive: Joi.boolean()
    .optional()
    .messages({
      "boolean.base": "isActive must be a boolean",
    }),
});











