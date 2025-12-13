import Joi from "joi";

export const createPurchaseSchema = Joi.object({
  supplierName: Joi.string()
    .required()
    .min(1)
    .max(255)
    .messages({
      "string.empty": "Supplier name is required",
      "string.min": "Supplier name must be at least 1 character long",
      "string.max": "Supplier name cannot exceed 255 characters",
      "any.required": "Supplier name is required",
    }),
  supplierPhone: Joi.string()
    .optional()
    .allow("", null)
    .max(20)
    .messages({
      "string.max": "Phone number cannot exceed 20 characters",
    }),
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
        cost: Joi.number()
          .min(0)
          .required()
          .messages({
            "number.base": "Cost must be a number",
            "number.min": "Cost cannot be negative",
            "any.required": "Cost is required",
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
        toWarehouse: Joi.boolean()
          .optional()
          .default(true),
      })
    )
    .min(1)
    .required()
    .messages({
      "array.min": "At least one item is required",
      "any.required": "Items are required",
    }),
  subtotal: Joi.number()
    .min(0)
    .required()
    .messages({
      "number.base": "Subtotal must be a number",
      "number.min": "Subtotal cannot be negative",
      "any.required": "Subtotal is required",
    }),
  tax: Joi.number()
    .optional()
    .min(0)
    .default(0)
    .messages({
      "number.base": "Tax must be a number",
      "number.min": "Tax cannot be negative",
    }),
  total: Joi.number()
    .min(0)
    .required()
    .messages({
      "number.base": "Total must be a number",
      "number.min": "Total cannot be negative",
      "any.required": "Total is required",
    }),
  payments: Joi.array()
    .items(
      Joi.object({
        type: Joi.string()
          .valid("cash", "card")
          .required()
          .messages({
            "any.only": "Payment type must be cash or card",
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
          .when("type", {
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
      })
    )
    .min(1)
    .required()
    .messages({
      "array.min": "At least one payment method is required",
      "any.required": "Payments are required",
    }),
  date: Joi.string()
    .optional()
    .isoDate()
    .messages({
      "string.isoDate": "Date must be a valid ISO date",
    }),
});

export const updatePurchaseSchema = Joi.object({
  supplierName: Joi.string()
    .optional()
    .min(1)
    .max(255)
    .messages({
      "string.min": "Supplier name must be at least 1 character long",
      "string.max": "Supplier name cannot exceed 255 characters",
    }),
  supplierPhone: Joi.string()
    .optional()
    .allow("", null)
    .max(20)
    .messages({
      "string.max": "Phone number cannot exceed 20 characters",
    }),
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().uuid().required(),
        quantity: Joi.number().integer().min(1).required(),
        cost: Joi.number().min(0).required(),
        discount: Joi.number().optional().min(0).max(100).default(0),
        toWarehouse: Joi.boolean().optional().default(true),
      })
    )
    .optional(),
  subtotal: Joi.number().optional().min(0),
  tax: Joi.number().optional().min(0).default(0),
  total: Joi.number().optional().min(0),
  payments: Joi.array()
    .items(
      Joi.object({
        type: Joi.string().valid("cash", "card").required(),
        amount: Joi.number().min(0).required(),
        cardId: Joi.string()
          .optional()
          .uuid()
          .allow("", null)
          .when("type", {
            is: "card",
            then: Joi.required(),
            otherwise: Joi.optional(),
          }),
        bankAccountId: Joi.string().optional().uuid().allow("", null),
      })
    )
    .optional(),
  date: Joi.string().optional().isoDate(),
});

export const addPaymentSchema = Joi.object({
  type: Joi.string()
    .valid("cash", "card")
    .required()
    .messages({
      "any.only": "Payment type must be cash or card",
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
    .when("type", {
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
  date: Joi.string()
    .optional()
    .isoDate()
    .messages({
      "string.isoDate": "Date must be a valid ISO date",
    }),
});

export const getPurchasesQuerySchema = Joi.object({
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
  supplierId: Joi.string()
    .optional()
    .uuid()
    .messages({
      "string.uuid": "Supplier ID must be a valid UUID",
    }),
});

