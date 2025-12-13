import Joi from "joi";

export const createSaleSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string()
          .uuid()
          .required()
          .messages({
            "string.uuid": "Product ID must be a valid UUID",
            "any.required": "Product ID is required",
          }),
        quantity: Joi.number()
          .integer()
          .min(1)
          .required()
          .messages({
            "number.base": "Quantity must be a number",
            "number.integer": "Quantity must be an integer",
            "number.min": "Quantity must be at least 1",
            "any.required": "Quantity is required",
          }),
        discount: Joi.number()
          .optional()
          .min(0)
          .max(100)
          .messages({
            "number.base": "Discount must be a number",
            "number.min": "Discount cannot be negative",
            "number.max": "Discount cannot exceed 100%",
          }),
      })
    )
    .min(1)
    .required()
    .messages({
      "array.min": "At least one item is required",
      "any.required": "Items are required",
    }),
  customerName: Joi.string()
    .optional()
    .allow("", null)
    .max(255)
    .messages({
      "string.max": "Customer name cannot exceed 255 characters",
    }),
  customerPhone: Joi.string()
    .optional()
    .allow("", null)
    .pattern(/^[0-9+\-\s()]*$/)
    .messages({
      "string.pattern.base": "Invalid phone number format",
    }),
  paymentType: Joi.string()
    .optional()
    .valid("cash", "credit", "card", "bank_transfer")
    .default("cash")
    .messages({
      "any.only": "Payment type must be one of: cash, credit, card, bank_transfer",
    }),
  payments: Joi.array()
    .items(
      Joi.object({
        type: Joi.string()
          .valid("cash", "card", "credit", "bank_transfer")
          .required()
          .messages({
            "any.only": "Payment type must be one of: cash, card, credit, bank_transfer",
            "any.required": "Payment type is required",
          }),
        amount: Joi.number()
          .min(0)
          .required()
          .messages({
            "number.base": "Payment amount must be a number",
            "number.min": "Payment amount cannot be negative",
            "any.required": "Payment amount is required",
          }),
        cardId: Joi.string()
          .optional()
          .uuid()
          .allow("", null)
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
      })
    )
    .optional()
    .messages({
      "array.base": "Payments must be an array",
    }),
  cardId: Joi.string()
    .optional()
    .uuid()
    .allow("", null)
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
  date: Joi.string()
    .optional()
    .isoDate()
    .messages({
      "string.isoDate": "Date must be a valid ISO date",
    }),
  fromWarehouse: Joi.boolean()
    .optional()
    .default(false)
    .messages({
      "boolean.base": "fromWarehouse must be a boolean",
    }),
  discount: Joi.number()
    .optional()
    .min(0)
    .max(100)
    .default(0)
    .messages({
      "number.base": "Discount must be a number",
      "number.min": "Discount cannot be negative",
      "number.max": "Discount cannot exceed 100%",
    }),
  tax: Joi.number()
    .optional()
    .min(0)
    .max(100)
    .default(0)
    .messages({
      "number.base": "Tax must be a number",
      "number.min": "Tax cannot be negative",
      "number.max": "Tax cannot exceed 100%",
    }),
});

export const getSalesQuerySchema = Joi.object({
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
  status: Joi.string()
    .optional()
    .valid("pending", "completed", "cancelled")
    .messages({
      "any.only": "Status must be one of: pending, completed, cancelled",
    }),
  search: Joi.string()
    .optional()
    .allow("")
    .messages({
      "string.base": "Search must be a string",
    }),
});

export const getSaleByBillNumberSchema = Joi.object({
  billNumber: Joi.string()
    .required()
    .pattern(/^BILL-\d{8}-\d{4}$/)
    .messages({
      "string.pattern.base": "Invalid bill number format",
      "any.required": "Bill number is required",
    }),
});

