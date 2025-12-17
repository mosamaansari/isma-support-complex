import Joi from "joi";

export const updateSettingsSchema = Joi.object({
  data: Joi.object({
    id: Joi.any().forbidden().messages({
      "any.unknown": "\"data.id\" is not allowed",
    }),
    createdAt: Joi.any().forbidden().messages({
      "any.unknown": "\"data.createdAt\" is not allowed",
    }),
    updatedAt: Joi.any().forbidden().messages({
      "any.unknown": "\"data.updatedAt\" is not allowed",
    }),
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
      .optional()
      .allow("", null)
      .email()
      .messages({
        "string.email": "Email must be a valid email address",
      }),
    address: Joi.string()
      .optional()
      .allow("", null)
      .max(500)
      .messages({
        "string.max": "Address cannot exceed 500 characters",
      }),
    gstNumber: Joi.string()
      .optional()
      .allow("", null)
      .max(50)
      .messages({
        "string.max": "GST number cannot exceed 50 characters",
      }),
  }).required(),
});


