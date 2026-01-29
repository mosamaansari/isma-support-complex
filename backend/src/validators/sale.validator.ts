import Joi from "joi";

export const createSaleSchema = Joi.object({
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
        unitPrice: Joi.number()
          .min(0)
          .required()
          .messages({
            "number.base": "Unit price must be a number",
            "number.min": "Unit price cannot be negative",
            "any.required": "Unit price is required",
          }),
        customPrice: Joi.number()
          .optional()
          .min(0)
          .allow(null)
          .messages({
            "number.base": "Custom price must be a number",
            "number.min": "Custom price cannot be negative",
          }),
        priceType: Joi.string()
          .optional()
          .valid("single", "dozen")
          .default("single")
          .messages({
            "any.only": "Price type must be either 'single' or 'dozen'",
          }),
        priceSingle: Joi.number()
          .optional()
          .min(0)
          .allow(null)
          .messages({
            "number.base": "Single price must be a number",
            "number.min": "Single price cannot be negative",
          }),
        priceDozen: Joi.number()
          .optional()
          .min(0)
          .allow(null)
          .messages({
            "number.base": "Dozen price must be a number",
            "number.min": "Dozen price cannot be negative",
          }),
        discount: Joi.number()
          .optional()
          .min(0)
          .when("discountType", {
            is: "percent",
            then: Joi.number().max(100).messages({
              "number.max": "Discount percentage cannot exceed 100%",
            }),
            otherwise: Joi.number().messages({
              "number.base": "Discount must be a number",
            }),
          })
          .messages({
            "number.base": "Discount must be a number",
            "number.min": "Discount cannot be negative",
          }),
        discountType: Joi.string()
          .optional()
          .valid("percent", "value")
          .default("percent")
          .messages({
            "any.only": "Discount type must be 'percent' or 'value'",
          }),
        productName: Joi.string()
          .optional()
          .messages({
            "string.base": "Product name must be a string",
          }),
        total: Joi.number()
          .optional()
          .min(0)
          .messages({
            "number.base": "Total must be a number",
            "number.min": "Total cannot be negative",
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
    .required()
    .trim()
    .min(1)
    .max(255)
    .messages({
      "string.empty": "Customer name is required",
      "any.required": "Customer name is required",
      "string.min": "Customer name cannot be empty",
      "string.max": "Customer name cannot exceed 255 characters",
    }),
  customerPhone: Joi.string()
    .optional()
    .allow("", null)
    .pattern(/^[0-9+\-\s()]*$/)
    .messages({
      "string.pattern.base": "Invalid phone number format",
    }),
  customerCity: Joi.string()
    .optional()
    .allow("", null)
    .max(50)
    .messages({
      "string.max": "City name must be less than or equal to 50 characters",
    }),
  paymentType: Joi.string()
    .optional()
    .valid("cash", "bank_transfer")
    .default("cash")
    .messages({
      "any.only": "Payment type must be one of: cash, bank_transfer",
    }),
  payments: Joi.array()
    .items(
      Joi.object({
        type: Joi.string()
          .valid("cash", "bank_transfer", "card", "credit")
          .required()
          .messages({
            "any.only": "Payment type must be one of: cash, bank_transfer, card, credit",
            "any.required": "Payment type is required",
          }),
        amount: Joi.number()
          .min(0)
          .optional()
          .allow(null)
          .messages({
            "number.base": "Payment amount must be a number",
            "number.min": "Payment amount cannot be negative",
          }),
        date: Joi.string()
          .optional()
          .isoDate()
          .allow("", null)
          .messages({
            "string.isoDate": "Payment date must be a valid ISO date",
          }),
        cardId: Joi.string()
          .optional()
          .allow("", null)
          .custom((value, helpers) => {
            if (value === "" || value === null || value === undefined) return null;
            if (typeof value === "string" && value.length > 0 && !value.startsWith("c")) {
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
    .optional()
    .messages({
      "array.base": "Payments must be an array",
    }),
  cardId: Joi.string()
    .optional()
    .allow("", null)
    .messages({
      "string.pattern.base": "Card ID must be a valid ID",
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
  deliveryCharges: Joi.number()
    .optional()
    .min(0)
    .default(0)
    .allow(null)
    .messages({
      "number.base": "Delivery charges must be a number",
      "number.min": "Delivery charges cannot be negative",
    }),
  taxType: Joi.string()
    .optional()
    .valid("percent", "value")
    .default("percent")
    .messages({
      "any.only": "Tax type must be either 'percent' or 'value'",
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

export const getSaleByBillNumberSchema = Joi.object({
  billNumber: Joi.string()
    .required()
    .pattern(/^BILL-\d{8}-\d{4}$/)
    .messages({
      "string.pattern.base": "Invalid bill number format",
      "any.required": "Bill number is required",
    }),
});

