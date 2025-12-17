import Joi from "joi";

export const createExpenseSchema = Joi.object({
  amount: Joi.number()
    .required()
    .min(0)
    .messages({
      "number.base": "Amount must be a number",
      "number.min": "Amount cannot be negative",
      "any.required": "Amount is required",
    }),
  category: Joi.string()
    .required()
    .max(100)
    .messages({
      "string.empty": "Category is required",
      "string.max": "Category cannot exceed 100 characters",
      "any.required": "Category is required",
    }),
  description: Joi.string()
    .optional()
    .allow("", null)
    .max(500)
    .messages({
      "string.max": "Description cannot exceed 500 characters",
    }),
  date: Joi.string()
    .optional()
    .isoDate()
    .messages({
      "string.isoDate": "Date must be a valid ISO date",
    }),
  paymentType: Joi.string()
    .optional()
    .valid("cash", "bank_transfer")
    .default("cash")
    .messages({
      "any.only": "Payment type must be one of: cash, bank_transfer",
    }),
  cardId: Joi.string()
    .optional()
    .allow("", null)
    .custom((value, helpers) => {
      // Convert empty string to null
      if (value === "" || value === null || value === undefined) {
        return null;
      }
      // Validate CUID format (starts with 'c' and is typically 25 chars)
      if (typeof value === 'string' && value.length > 0 && !value.startsWith('c')) {
        return helpers.error("string.pattern.base", { message: "Card ID must be a valid ID" });
      }
      return value;
    })
    .messages({
      "string.pattern.base": "Card ID must be a valid ID",
    }),
  bankAccountId: Joi.string()
    .optional()
    .allow("", null)
    .custom((value, helpers) => {
      // Convert empty string to null
      if (value === "" || value === null || value === undefined) {
        return null;
      }
      // Validate CUID format (starts with 'c' and is typically 25 chars)
      if (typeof value === 'string' && value.length > 0 && !value.startsWith('c')) {
        return helpers.error("string.pattern.base", { message: "Bank account ID must be a valid ID" });
      }
      return value;
    })
    .messages({
      "string.pattern.base": "Bank account ID must be a valid ID",
    }),
});

export const updateExpenseSchema = Joi.object({
  amount: Joi.number()
    .optional()
    .min(0)
    .messages({
      "number.base": "Amount must be a number",
      "number.min": "Amount cannot be negative",
    }),
  category: Joi.string()
    .optional()
    .max(100)
    .messages({
      "string.max": "Category cannot exceed 100 characters",
    }),
  description: Joi.string()
    .optional()
    .allow("", null)
    .max(500)
    .messages({
      "string.max": "Description cannot exceed 500 characters",
    }),
  date: Joi.string()
    .optional()
    .isoDate()
    .messages({
      "string.isoDate": "Date must be a valid ISO date",
    }),
  paymentType: Joi.string()
    .optional()
    .valid("cash", "bank_transfer")
    .messages({
      "any.only": "Payment type must be one of: cash, bank_transfer",
    }),
  cardId: Joi.string()
    .optional()
    .allow("", null)
    .custom((value, helpers) => {
      // Convert empty string to null
      if (value === "" || value === null || value === undefined) {
        return null;
      }
      // Validate CUID format (starts with 'c' and is typically 25 chars)
      if (typeof value === 'string' && value.length > 0 && !value.startsWith('c')) {
        return helpers.error("string.pattern.base", { message: "Card ID must be a valid ID" });
      }
      return value;
    })
    .messages({
      "string.pattern.base": "Card ID must be a valid ID",
    }),
  bankAccountId: Joi.string()
    .optional()
    .allow("", null)
    .custom((value, helpers) => {
      // Convert empty string to null
      if (value === "" || value === null || value === undefined) {
        return null;
      }
      // Validate CUID format (starts with 'c' and is typically 25 chars)
      if (typeof value === 'string' && value.length > 0 && !value.startsWith('c')) {
        return helpers.error("string.pattern.base", { message: "Bank account ID must be a valid ID" });
      }
      return value;
    })
    .messages({
      "string.pattern.base": "Bank account ID must be a valid ID",
    }),
});

export const getExpensesQuerySchema = Joi.object({
  startDate: Joi.string()
    .optional()
    .isoDate()
    .messages({
      "string.isoDate": "Start date must be a valid ISO date",
    }),
  endDate: Joi.string()
    .optional()
    .isoDate()
    .messages({
      "string.isoDate": "End date must be a valid ISO date",
    }),
  category: Joi.string()
    .optional()
    .allow("")
    .messages({
      "string.base": "Category must be a string",
    }),
  search: Joi.string()
    .optional()
    .allow("")
    .messages({
      "string.base": "Search must be a string",
    }),
  page: Joi.number()
    .integer()
    .min(1)
    .optional()
    .messages({
      "number.base": "Page must be a number",
      "number.integer": "Page must be an integer",
      "number.min": "Page must be at least 1",
    }),
  pageSize: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .messages({
      "number.base": "Page size must be a number",
      "number.integer": "Page size must be an integer",
      "number.min": "Page size must be at least 1",
      "number.max": "Page size cannot exceed 100",
    }),
});

