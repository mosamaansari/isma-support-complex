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
          .required()
          .trim()
          .min(1)
          .messages({
            "any.required": "Product ID is required",
            "string.empty": "Product ID cannot be empty",
            "string.min": "Product ID cannot be empty",
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
        shopQuantity: Joi.number()
          .integer()
          .min(0)
          .optional()
          .default(0)
          .messages({
            "number.base": "Shop quantity must be a number",
            "number.integer": "Shop quantity must be an integer",
            "number.min": "Shop quantity cannot be negative",
          }),
        warehouseQuantity: Joi.number()
          .integer()
          .min(0)
          .optional()
          .default(0)
          .messages({
            "number.base": "Warehouse quantity must be a number",
            "number.integer": "Warehouse quantity must be an integer",
            "number.min": "Warehouse quantity cannot be negative",
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
  discount: Joi.number()
    .optional()
    .min(0)
    .when("discountType", {
      is: "percent",
      then: Joi.number().max(100).messages({
        "number.max": "Discount percentage cannot exceed 100%",
      }),
      otherwise: Joi.number().max(10000000).messages({
        "number.max": "Discount amount is too large",
      }),
    })
    .default(0)
    .allow(null)
    .messages({
      "number.base": "Discount must be a number",
      "number.min": "Discount cannot be negative",
    }),
  discountType: Joi.string()
    .optional()
    .valid("percent", "value")
    .default("percent")
    .messages({
      "any.only": "Discount type must be either 'percent' or 'value'",
    }),
  tax: Joi.number()
    .optional()
    .min(0)
    .when("taxType", {
      is: "percent",
      then: Joi.number().max(100).messages({
        "number.max": "Tax percentage cannot exceed 100%",
      }),
      otherwise: Joi.number().max(10000000).messages({
        "number.max": "Tax amount is too large",
      }),
    })
    .default(0)
    .allow(null)
    .messages({
      "number.base": "Tax must be a number",
      "number.min": "Tax cannot be negative",
    }),
  taxType: Joi.string()
    .optional()
    .valid("percent", "value")
    .default("percent")
    .messages({
      "any.only": "Tax type must be either 'percent' or 'value'",
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
          .valid("cash", "bank_transfer")
          .required()
          .messages({
            "any.only": "Payment type must be cash or bank_transfer",
            "any.required": "Payment type is required",
          }),
        amount: Joi.number()
          .min(0.01)
          .required()
          .messages({
            "number.base": "Payment amount must be a number",
            "number.min": "Payment amount must be greater than 0",
            "any.required": "Payment amount is required",
          }),
        cardId: Joi.string()
          .optional()
          .uuid()
          .allow("", null)
          .when("type", {
            is: "card",
            then: Joi.required().messages({
              "any.required": "Bank account ID is required when payment type is bank_transfer",
            }),
            otherwise: Joi.optional(),
          })
          .messages({
            "string.uuid": "Card ID must be a valid UUID",
          }),
        bankAccountId: Joi.string()
          .optional()
          .allow("", null)
          .custom((value, helpers) => {
            if (value === "" || value === null || value === undefined) return null;
            if (typeof value === "string" && value.length > 0 && !value.startsWith("c")) {
              return helpers.error("string.pattern.base", { message: "Bank account ID must be a valid ID" });
            }
            return value;
          })
          .messages({
            "string.pattern.base": "Bank account ID must be a valid ID",
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
        productId: Joi.string()
          .required()
          .trim()
          .min(1)
          .messages({
            "any.required": "Product ID is required",
            "string.empty": "Product ID cannot be empty",
            "string.min": "Product ID cannot be empty",
          }),
        quantity: Joi.number().integer().min(1).required(),
        shopQuantity: Joi.number().integer().min(0).optional().default(0),
        warehouseQuantity: Joi.number().integer().min(0).optional().default(0),
        cost: Joi.number().min(0.01).required().messages({
          "number.base": "Cost must be a number",
          "number.min": "Cost must be greater than 0",
          "any.required": "Cost is required",
        }),
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
    .valid("cash", "bank_transfer")
    .required()
    .messages({
      "any.only": "Payment type must be cash or bank_transfer",
      "any.required": "Payment type is required",
    }),
  amount: Joi.number()
    .min(0.01)
    .required()
    .messages({
      "number.base": "Payment amount must be a number",
      "number.min": "Payment amount must be greater than 0",
      "any.required": "Payment amount is required",
    }),
  bankAccountId: Joi.string()
    .optional()
    .allow("", null)
    .custom((value, helpers) => {
      if (value === "" || value === null || value === undefined) return null;
      if (typeof value === "string" && value.length > 0 && !value.startsWith("c")) {
        return helpers.error("string.pattern.base", { message: "Bank account ID must be a valid ID" });
      }
      return value;
    })
    .when("type", {
      is: "bank_transfer",
      then: Joi.required().messages({
        "any.required": "Bank account ID is required when payment type is bank_transfer",
      }),
      otherwise: Joi.optional(),
    })
    .messages({
      "string.pattern.base": "Bank account ID must be a valid ID",
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
    .allow("", null)
    .messages({
      "string.base": "Supplier ID must be a string",
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

