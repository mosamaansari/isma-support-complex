import Joi from "joi";

// Strict password validation pattern (for password creation/change only)
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

// Simple password validation for login (just check minimum length, not format)
// Login is for authenticating with existing password, not creating new one
export const loginSchema = Joi.object({
  username: Joi.string()
    .required()
    .messages({
      "string.empty": "Username is required",
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
});

export const superAdminLoginSchema = Joi.object({
  username: Joi.string()
    .required()
    .messages({
      "string.empty": "Username is required",
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
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().trim().messages({
    "string.email": "Please provide a valid email address",
    "string.empty": "Email is required",
    "any.required": "Email is required",
  }),
  userType: Joi.string().valid("user", "admin").optional().default("user"),
});

export const resetPasswordSchema = Joi.object({
  token: Joi.string().required().trim().messages({
    "string.empty": "Reset token is required",
    "any.required": "Reset token is required",
  }),
  newPassword: strictPasswordValidation.messages({
    "string.empty": "New password is required",
    "string.min": "New password must be at least 6 characters long",
    "string.pattern.base": "New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
    "any.required": "New password is required",
  }),
  userType: Joi.string().valid("user", "admin").optional().default("user"),
});


