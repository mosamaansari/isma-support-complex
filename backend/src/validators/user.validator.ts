import Joi from "joi";

// Strict password validation pattern
// Must have: minimum 6 characters, at least one uppercase, one lowercase, one number, and one special character
const strictPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/])[A-Za-z\d@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/]{6,}$/;

const strictPasswordValidation = Joi.string()
  .required()
  .min(6)
  .pattern(strictPasswordPattern)
  .messages({
    "string.empty": "Password is required",
    "string.min": "Password must be at least 6 characters long",
    "string.pattern.base": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    "any.required": "Password is required",
  });

export const createUserSchema = Joi.object({
  username: Joi.string()
    .required()
    .trim()
    .min(3)
    .max(50)
    .pattern(/^[a-zA-Z0-9_]+$/)
    .messages({
      "string.empty": "Username is required",
      "string.min": "Username must be at least 3 characters long",
      "string.max": "Username cannot exceed 50 characters",
      "string.pattern.base": "Username can only contain letters, numbers, and underscores",
      "any.required": "Username is required",
    }),
  password: strictPasswordValidation,
  name: Joi.string()
    .required()
    .trim()
    .min(2)
    .max(100)
    .pattern(/^[a-zA-Z\s'-]+$/)
    .messages({
      "string.empty": "Name is required",
      "string.min": "Name must be at least 2 characters long",
      "string.max": "Name cannot exceed 100 characters",
      "string.pattern.base": "Name can only contain letters, spaces, hyphens, and apostrophes",
      "any.required": "Name is required",
    })
    .custom((value, helpers) => {
      // Check for multiple consecutive spaces
      if (/\s{2,}/.test(value)) {
        return helpers.error("string.pattern.base", {
          message: "Name cannot have multiple consecutive spaces",
        });
      }
      // Check if name is only spaces
      if (value.trim().length === 0) {
        return helpers.error("string.empty", { message: "Name cannot be only spaces" });
      }
      return value;
    }),
  email: Joi.string()
    .optional()
    .trim()
    .email()
    .allow("", null)
    .max(100)
    .messages({
      "string.email": "Email must be a valid email address",
      "string.max": "Email cannot exceed 100 characters",
    })
    .custom((value, helpers) => {
      // If email is provided, it should not be only spaces
      if (value && value.trim().length === 0 && value.length > 0) {
        return helpers.error("string.email", { message: "Email cannot be only spaces" });
      }
      return value;
    }),
  role: Joi.string()
    .required()
    .min(1)
    .max(50)
    .messages({
      "string.empty": "Role is required",
      "string.min": "Role must be at least 1 character long",
      "string.max": "Role cannot exceed 50 characters",
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
    .trim()
    .min(2)
    .max(100)
    .pattern(/^[a-zA-Z\s'-]+$/)
    .messages({
      "string.min": "Name must be at least 2 characters long",
      "string.max": "Name cannot exceed 100 characters",
      "string.pattern.base": "Name can only contain letters, spaces, hyphens, and apostrophes",
    })
    .custom((value, helpers) => {
      if (!value) return value; // Optional field
      // Check for multiple consecutive spaces
      if (/\s{2,}/.test(value)) {
        return helpers.error("string.pattern.base", {
          message: "Name cannot have multiple consecutive spaces",
        });
      }
      // Check if name is only spaces
      if (value.trim().length === 0) {
        return helpers.error("string.empty", { message: "Name cannot be only spaces" });
      }
      return value;
    }),
  email: Joi.string()
    .optional()
    .trim()
    .email()
    .allow("", null)
    .max(100)
    .messages({
      "string.email": "Email must be a valid email address",
      "string.max": "Email cannot exceed 100 characters",
    })
    .custom((value, helpers) => {
      // If email is provided, it should not be only spaces
      if (value && value.trim().length === 0 && value.length > 0) {
        return helpers.error("string.email", { message: "Email cannot be only spaces" });
      }
      return value;
    }),
  role: Joi.string()
    .optional()
    .min(1)
    .max(50)
    .messages({
      "string.min": "Role must be at least 1 character long",
      "string.max": "Role cannot exceed 50 characters",
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
    .pattern(strictPasswordPattern)
    .messages({
      "string.min": "Password must be at least 6 characters long",
      "string.pattern.base": "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    }),
  profilePicture: Joi.string()
    .optional()
    .allow("", null)
    .messages({
      "string.base": "Profile picture must be a string",
    }),
});

// Profile information update schema (name, email, profilePicture only)
export const updateProfileSchema = Joi.object({
  name: Joi.string()
    .required()
    .min(1)
    .max(255)
    .trim()
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
    .trim()
    .messages({
      "string.email": "Email must be a valid email address",
    }),
  profilePicture: Joi.string()
    .optional()
    .allow("", null)
    .messages({
      "string.base": "Profile picture must be a string",
    }),
});

// Password change schema
export const updatePasswordSchema = Joi.object({
  currentPassword: Joi.string()
    .required()
    .messages({
      "string.empty": "Current password is required",
      "any.required": "Current password is required",
    }),
  newPassword: strictPasswordValidation.max(100).messages({
    "string.empty": "New password is required",
    "string.min": "New password must be at least 6 characters long",
    "string.max": "New password cannot exceed 100 characters",
    "string.pattern.base": "New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    "any.required": "New password is required",
  }),
  confirmPassword: Joi.string()
    .required()
    .valid(Joi.ref("newPassword"))
    .messages({
      "string.empty": "Please confirm your new password",
      "any.only": "Passwords must match",
      "any.required": "Please confirm your new password",
    }),
});

export const getUsersQuerySchema = Joi.object({
  page: Joi.number().optional().min(1).default(1),
  pageSize: Joi.number().optional().min(1).max(100).default(10),
  search: Joi.string().optional().allow(""),
});


