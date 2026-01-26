import Joi from "joi";

export const createExpenseCategorySchema = Joi.object({
  name: Joi.string()
    .required()
    .min(1)
    .max(100)
    .trim()
    .messages({
      "string.empty": "Expense category name is required",
      "string.min": "Expense category name must be at least 1 character long",
      "string.max": "Expense category name cannot exceed 100 characters",
      "any.required": "Expense category name is required",
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

export const updateExpenseCategorySchema = Joi.object({
  name: Joi.string()
    .optional()
    .min(1)
    .max(100)
    .trim()
    .messages({
      "string.min": "Expense category name must be at least 1 character long",
      "string.max": "Expense category name cannot exceed 100 characters",
    }),
  description: Joi.string()
    .optional()
    .allow("", null)
    .max(500)
    .trim()
    .messages({
      "string.max": "Description cannot exceed 500 characters",
    }),
}).min(1);

