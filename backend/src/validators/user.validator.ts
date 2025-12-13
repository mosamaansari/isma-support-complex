import Joi from "joi";

export const createUserSchema = Joi.object({
  username: Joi.string()
    .required()
    .min(3)
    .max(50)
    .alphanum()
    .messages({
      "string.empty": "Username is required",
      "string.min": "Username must be at least 3 characters long",
      "string.max": "Username cannot exceed 50 characters",
      "string.alphanum": "Username must contain only alphanumeric characters",
      "any.required": "Username is required",
    }),
  password: Joi.string()
    .required()
    .min(6)
    .messages({
      "string.empty": "Password is required",
      "string.min": "Password must be at least 6 characters long",
      "any.required": "Password is required",
    }),
  name: Joi.string()
    .required()
    .min(1)
    .max(255)
    .messages({
      "string.empty": "Name is required",
      "string.min": "Name must be at least 1 character long",
      "string.max": "Name cannot exceed 255 characters",
      "any.required": "Name is required",
    }),
  email: Joi.string()
    .optional()
    .email()
    .allow("", null)
    .messages({
      "string.email": "Email must be a valid email address",
    }),
  role: Joi.string()
    .required()
    .valid("superadmin", "admin", "cashier", "warehouse_manager")
    .messages({
      "any.only": "Role must be one of: superadmin, admin, cashier, warehouse_manager",
      "any.required": "Role is required",
    }),
  permissions: Joi.array()
    .items(Joi.string())
    .optional()
    .default([])
    .messages({
      "array.base": "Permissions must be an array",
    }),
  profilePicture: Joi.string()
    .optional()
    .allow("", null)
    .messages({
      "string.base": "Profile picture must be a string",
    }),
});

export const updateUserSchema = Joi.object({
  name: Joi.string()
    .optional()
    .min(1)
    .max(255)
    .messages({
      "string.min": "Name must be at least 1 character long",
      "string.max": "Name cannot exceed 255 characters",
    }),
  email: Joi.string()
    .optional()
    .email()
    .allow("", null)
    .messages({
      "string.email": "Email must be a valid email address",
    }),
  role: Joi.string()
    .optional()
    .valid("superadmin", "admin", "cashier", "warehouse_manager")
    .messages({
      "any.only": "Role must be one of: superadmin, admin, cashier, warehouse_manager",
    }),
  permissions: Joi.array()
    .items(Joi.string())
    .optional()
    .messages({
      "array.base": "Permissions must be an array",
    }),
  password: Joi.string()
    .optional()
    .min(6)
    .messages({
      "string.min": "Password must be at least 6 characters long",
    }),
  profilePicture: Joi.string()
    .optional()
    .allow("", null)
    .messages({
      "string.base": "Profile picture must be a string",
    }),
});

export const updateProfileSchema = Joi.object({
  name: Joi.string()
    .optional()
    .min(1)
    .max(255)
    .messages({
      "string.min": "Name must be at least 1 character long",
      "string.max": "Name cannot exceed 255 characters",
    }),
  email: Joi.string()
    .optional()
    .email()
    .allow("", null)
    .messages({
      "string.email": "Email must be a valid email address",
    }),
  currentPassword: Joi.string()
    .optional()
    .messages({
      "string.base": "Current password must be a string",
    }),
  password: Joi.string()
    .optional()
    .min(6)
    .when("currentPassword", {
      is: Joi.exist(),
      then: Joi.required(),
      otherwise: Joi.optional(),
    })
    .messages({
      "string.min": "Password must be at least 6 characters long",
      "any.required": "Password is required when changing password",
    }),
  profilePicture: Joi.string()
    .optional()
    .allow("", null)
    .messages({
      "string.base": "Profile picture must be a string",
    }),
});


