import Joi from "joi";

export const updateSettingsSchema = Joi.object({
  shopName: Joi.string()
    .required()
    .min(1)
    .max(255)
    .messages({
      "string.empty": "Shop name is required",
      "string.min": "Shop name must be at least 1 character long",
      "string.max": "Shop name cannot exceed 255 characters",
      "any.required": "Shop name is required",
    }),
  logo: Joi.string()
    .optional()
    .allow("", null)
    .max(500)
    .messages({
      "string.max": "Logo path cannot exceed 500 characters",
    }),
  contactNumber: Joi.string()
    .required()
    .min(1)
    .max(50)
    .messages({
      "string.empty": "Contact number is required",
      "string.min": "Contact number must be at least 1 character long",
      "string.max": "Contact number cannot exceed 50 characters",
      "any.required": "Contact number is required",
    }),
  email: Joi.string()
    .required()
    .email()
    .messages({
      "string.email": "Email must be a valid email address",
      "string.empty": "Email is required",
      "any.required": "Email is required",
    }),
  address: Joi.string()
    .required()
    .min(1)
    .max(500)
    .messages({
      "string.empty": "Address is required",
      "string.min": "Address must be at least 1 character long",
      "string.max": "Address cannot exceed 500 characters",
      "any.required": "Address is required",
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
  bankAccountNumber: Joi.string()
    .required()
    .min(1)
    .max(50)
    .messages({
      "string.empty": "Bank account number is required",
      "string.min": "Bank account number must be at least 1 character long",
      "string.max": "Bank account number cannot exceed 50 characters",
      "any.required": "Bank account number is required",
    }),
  ifscCode: Joi.string()
    .required()
    .min(1)
    .max(50)
    .messages({
      "string.empty": "IFSC code is required",
      "string.min": "IFSC code must be at least 1 character long",
      "string.max": "IFSC code cannot exceed 50 characters",
      "any.required": "IFSC code is required",
    }),
  gstNumber: Joi.string()
    .optional()
    .allow("", null)
    .max(50)
    .messages({
      "string.max": "GST number cannot exceed 50 characters",
    }),
});


