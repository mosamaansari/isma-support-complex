import Joi from "joi";

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


