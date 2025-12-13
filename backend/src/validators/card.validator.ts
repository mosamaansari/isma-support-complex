import Joi from "joi";

export const createCardSchema = Joi.object({
  name: Joi.string()
    .required()
    .min(1)
    .max(255)
    .messages({
      "string.empty": "Card name is required",
      "string.min": "Card name must be at least 1 character long",
      "string.max": "Card name cannot exceed 255 characters",
      "any.required": "Card name is required",
    }),
  cardNumber: Joi.string()
    .optional()
    .allow("", null)
    .max(50)
    .messages({
      "string.max": "Card number cannot exceed 50 characters",
    }),
  bankName: Joi.string()
    .optional()
    .allow("", null)
    .max(255)
    .messages({
      "string.max": "Bank name cannot exceed 255 characters",
    }),
  accountHolder: Joi.string()
    .optional()
    .allow("", null)
    .max(255)
    .messages({
      "string.max": "Account holder name cannot exceed 255 characters",
    }),
  isDefault: Joi.boolean()
    .optional()
    .default(false)
    .messages({
      "boolean.base": "isDefault must be a boolean",
    }),
  isActive: Joi.boolean()
    .optional()
    .default(true)
    .messages({
      "boolean.base": "isActive must be a boolean",
    }),
});

export const updateCardSchema = Joi.object({
  name: Joi.string()
    .optional()
    .min(1)
    .max(255)
    .messages({
      "string.min": "Card name must be at least 1 character long",
      "string.max": "Card name cannot exceed 255 characters",
    }),
  cardNumber: Joi.string()
    .optional()
    .allow("", null)
    .max(50)
    .messages({
      "string.max": "Card number cannot exceed 50 characters",
    }),
  bankName: Joi.string()
    .optional()
    .allow("", null)
    .max(255)
    .messages({
      "string.max": "Bank name cannot exceed 255 characters",
    }),
  accountHolder: Joi.string()
    .optional()
    .allow("", null)
    .max(255)
    .messages({
      "string.max": "Account holder name cannot exceed 255 characters",
    }),
  isDefault: Joi.boolean()
    .optional()
    .messages({
      "boolean.base": "isDefault must be a boolean",
    }),
  isActive: Joi.boolean()
    .optional()
    .messages({
      "boolean.base": "isActive must be a boolean",
    }),
});


