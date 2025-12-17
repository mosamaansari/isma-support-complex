import Joi from "joi";

export const createBankAccountSchema = Joi.object({
  accountName: Joi.string()
    .required()
    .min(1)
    .max(255)
    .messages({
      "string.empty": "Account name is required",
      "string.min": "Account name must be at least 1 character long",
      "string.max": "Account name cannot exceed 255 characters",
      "any.required": "Account name is required",
    }),
  accountNumber: Joi.string()
    .required()
    .min(1)
    .max(50)
    .messages({
      "string.empty": "Account number is required",
      "string.min": "Account number must be at least 1 character long",
      "string.max": "Account number cannot exceed 50 characters",
      "any.required": "Account number is required",
    }),
  bankName: Joi.string()
    .required()
    .min(1)
    .max(255)
    .messages({
      "string.empty": "Bank name is required",
      "string.min": "Bank name must be at least 1 character long",
      "string.max": "Bank name cannot exceed 255 characters",
      "any.required": "Bank name is required",
    }),
  accountHolder: Joi.string()
    .optional()
    .allow("", null)
    .max(255)
    .messages({
      "string.max": "Account holder name cannot exceed 255 characters",
    }),
  branchName: Joi.string()
    .optional()
    .allow("", null)
    .max(255)
    .messages({
      "string.max": "Branch name cannot exceed 255 characters",
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

export const updateBankAccountSchema = Joi.object({
  accountName: Joi.string()
    .optional()
    .min(1)
    .max(255)
    .messages({
      "string.min": "Account name must be at least 1 character long",
      "string.max": "Account name cannot exceed 255 characters",
    }),
  accountNumber: Joi.string()
    .optional()
    .min(1)
    .max(50)
    .messages({
      "string.min": "Account number must be at least 1 character long",
      "string.max": "Account number cannot exceed 50 characters",
    }),
  bankName: Joi.string()
    .optional()
    .min(1)
    .max(255)
    .messages({
      "string.min": "Bank name must be at least 1 character long",
      "string.max": "Bank name cannot exceed 255 characters",
    }),
  accountHolder: Joi.string()
    .optional()
    .allow("", null)
    .max(255)
    .messages({
      "string.max": "Account holder name cannot exceed 255 characters",
    }),
  branchName: Joi.string()
    .optional()
    .allow("", null)
    .max(255)
    .messages({
      "string.max": "Branch name cannot exceed 255 characters",
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


