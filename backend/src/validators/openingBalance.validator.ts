import Joi from "joi";

export const createOpeningBalanceSchema = Joi.object({
  date: Joi.string()
    .required()
    .isoDate()
    .messages({
      "string.isoDate": "Date must be a valid ISO date",
      "any.required": "Date is required",
    }),
  cashBalance: Joi.number()
    .min(1)
    .required()
    .messages({
      "number.base": "Cash balance must be a number",
      "number.min": "Cash balance must be at least 1",
      "any.required": "Cash balance is required",
    }),
  cardBalances: Joi.array()
    .items(
      Joi.object({
        cardId: Joi.string().uuid().required().messages({
          "string.uuid": "Card ID must be a valid UUID",
          "any.required": "Card ID is required",
        }),
        balance: Joi.number().min(0).required().messages({
          "number.base": "Card balance must be a number",
          "number.min": "Card balance cannot be negative",
          "any.required": "Card balance is required",
        }),
      })
    )
    .optional()
    .default([])
    .messages({
      "array.base": "Card balances must be an array",
    }),
  notes: Joi.string()
    .optional()
    .allow("", null)
    .max(500)
    .messages({
      "string.max": "Notes cannot exceed 500 characters",
    }),
});

export const updateOpeningBalanceSchema = Joi.object({
  cashBalance: Joi.number()
    .min(1)
    .optional()
    .messages({
      "number.base": "Cash balance must be a number",
      "number.min": "Cash balance must be at least 1",
    }),
  cardBalances: Joi.array()
    .items(
      Joi.object({
        cardId: Joi.string().uuid().required(),
        balance: Joi.number().min(0).required(),
      })
    )
    .optional()
    .messages({
      "array.base": "Card balances must be an array",
    }),
  notes: Joi.string()
    .optional()
    .allow("", null)
    .max(500)
    .messages({
      "string.max": "Notes cannot exceed 500 characters",
    }),
});

export const getOpeningBalancesQuerySchema = Joi.object({
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
});

export const getReportQuerySchema = Joi.object({
  date: Joi.string()
    .optional()
    .isoDate()
    .messages({
      "string.isoDate": "Date must be a valid ISO date",
    }),
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
});

