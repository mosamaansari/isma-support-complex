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
    .required()
    .min(1)
    .max(500)
    .messages({
      "string.empty": "Description is required",
      "string.min": "Description must be at least 1 character long",
      "string.max": "Description cannot exceed 500 characters",
      "any.required": "Description is required",
    }),
  date: Joi.string()
    .optional()
    .isoDate()
    .messages({
      "string.isoDate": "Date must be a valid ISO date",
    }),
  paymentType: Joi.string()
    .optional()
    .valid("cash", "card", "credit", "bank_transfer")
    .default("cash")
    .messages({
      "any.only": "Payment type must be one of: cash, card, credit, bank_transfer",
    }),
  cardId: Joi.string()
    .optional()
    .uuid()
    .allow("", null)
    .when("paymentType", {
      is: "card",
      then: Joi.required().messages({
        "any.required": "Card ID is required when payment type is card",
      }),
      otherwise: Joi.optional(),
    })
    .messages({
      "string.uuid": "Card ID must be a valid UUID",
    }),
  bankAccountId: Joi.string()
    .optional()
    .uuid()
    .allow("", null)
    .messages({
      "string.uuid": "Bank account ID must be a valid UUID",
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
    .min(1)
    .max(500)
    .messages({
      "string.min": "Description must be at least 1 character long",
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
    .valid("cash", "card", "credit", "bank_transfer")
    .messages({
      "any.only": "Payment type must be one of: cash, card, credit, bank_transfer",
    }),
  cardId: Joi.string()
    .optional()
    .uuid()
    .allow("", null)
    .when("paymentType", {
      is: "card",
      then: Joi.required().messages({
        "any.required": "Card ID is required when payment type is card",
      }),
      otherwise: Joi.optional(),
    })
    .messages({
      "string.uuid": "Card ID must be a valid UUID",
    }),
  bankAccountId: Joi.string()
    .optional()
    .uuid()
    .allow("", null)
    .messages({
      "string.uuid": "Bank account ID must be a valid UUID",
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
});

