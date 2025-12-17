import Joi from "joi";

export const createProductSchema = Joi.object({
  name: Joi.string()
    .required()
    .min(1)
    .max(255)
    .messages({
      "string.empty": "Product name is required",
      "string.min": "Product name must be at least 1 character long",
      "string.max": "Product name cannot exceed 255 characters",
      "any.required": "Product name is required",
    }),
  category: Joi.string()
    .optional()
    .allow("", null)
    .max(100)
    .messages({
      "string.max": "Category cannot exceed 100 characters",
    }),
  categoryId: Joi.string()
    .optional()
    .uuid()
    .allow("", null)
    .messages({
      "string.uuid": "Category ID must be a valid UUID",
    }),
  salePrice: Joi.number()
    .required()
    .min(0.01)
    .messages({
      "number.base": "Sale price must be a number",
      "number.min": "Sale price must be greater than 0",
      "any.required": "Sale price is required",
    }),
  shopQuantity: Joi.number()
    .required()
    .integer()
    .min(0)
    .default(0)
    .messages({
      "number.base": "Shop quantity must be a number",
      "number.integer": "Shop quantity must be an integer",
      "number.min": "Shop quantity cannot be negative",
      "any.required": "Shop quantity is required",
    }),
  warehouseQuantity: Joi.number()
    .required()
    .integer()
    .min(0)
    .default(0)
    .messages({
      "number.base": "Warehouse quantity must be a number",
      "number.integer": "Warehouse quantity must be an integer",
      "number.min": "Warehouse quantity cannot be negative",
      "any.required": "Warehouse quantity is required",
    }),
  shopMinStockLevel: Joi.number()
    .optional()
    .integer()
    .min(0)
    .default(0)
    .messages({
      "number.base": "Shop minimum stock must be a number",
      "number.integer": "Shop minimum stock must be an integer",
      "number.min": "Shop minimum stock cannot be negative",
    }),
  warehouseMinStockLevel: Joi.number()
    .optional()
    .integer()
    .min(0)
    .default(0)
    .messages({
      "number.base": "Warehouse minimum stock must be a number",
      "number.integer": "Warehouse minimum stock must be an integer",
      "number.min": "Warehouse minimum stock cannot be negative",
    }),
  minStockLevel: Joi.number()
    .optional()
    .integer()
    .min(0)
    .default(10)
    .messages({
      "number.base": "Minimum stock level must be a number",
      "number.integer": "Minimum stock level must be an integer",
      "number.min": "Minimum stock level cannot be negative",
    }),
  model: Joi.string()
    .optional()
    .allow("", null)
    .max(100)
    .messages({
      "string.max": "Model cannot exceed 100 characters",
    }),
  manufacturer: Joi.string()
    .optional()
    .allow("", null)
    .max(100)
    .messages({
      "string.max": "Manufacturer cannot exceed 100 characters",
    }),
  barcode: Joi.string()
    .optional()
    .allow("", null)
    .max(100)
    .messages({
      "string.max": "Barcode cannot exceed 100 characters",
    }),
  image: Joi.string()
    .optional()
    .allow("", null)
    .messages({
      "string.base": "Image must be a string",
    }),
  description: Joi.string()
    .optional()
    .allow("", null)
    .max(1000)
    .messages({
      "string.max": "Description cannot exceed 1000 characters",
    }),
});

export const updateProductSchema = Joi.object({
  name: Joi.string()
    .optional()
    .min(1)
    .max(255)
    .messages({
      "string.min": "Product name must be at least 1 character long",
      "string.max": "Product name cannot exceed 255 characters",
    }),
  category: Joi.string()
    .optional()
    .allow("", null)
    .max(100)
    .messages({
      "string.max": "Category cannot exceed 100 characters",
    }),
  categoryId: Joi.string()
    .optional()
    .uuid()
    .allow("", null)
    .messages({
      "string.uuid": "Category ID must be a valid UUID",
    }),
  salePrice: Joi.number()
    .optional()
    .min(0.01)
    .messages({
      "number.base": "Sale price must be a number",
      "number.min": "Sale price must be greater than 0",
    }),
  shopQuantity: Joi.number()
    .optional()
    .integer()
    .min(0)
    .messages({
      "number.base": "Shop quantity must be a number",
      "number.integer": "Shop quantity must be an integer",
      "number.min": "Shop quantity cannot be negative",
    }),
  warehouseQuantity: Joi.number()
    .optional()
    .integer()
    .min(0)
    .messages({
      "number.base": "Warehouse quantity must be a number",
      "number.integer": "Warehouse quantity must be an integer",
      "number.min": "Warehouse quantity cannot be negative",
    }),
  shopMinStockLevel: Joi.number()
    .optional()
    .integer()
    .min(0)
    .messages({
      "number.base": "Shop minimum stock must be a number",
      "number.integer": "Shop minimum stock must be an integer",
      "number.min": "Shop minimum stock cannot be negative",
    }),
  warehouseMinStockLevel: Joi.number()
    .optional()
    .integer()
    .min(0)
    .messages({
      "number.base": "Warehouse minimum stock must be a number",
      "number.integer": "Warehouse minimum stock must be an integer",
      "number.min": "Warehouse minimum stock cannot be negative",
    }),
  minStockLevel: Joi.number()
    .optional()
    .integer()
    .min(0)
    .messages({
      "number.base": "Minimum stock level must be a number",
      "number.integer": "Minimum stock level must be an integer",
      "number.min": "Minimum stock level cannot be negative",
    }),
  model: Joi.string()
    .optional()
    .allow("", null)
    .max(100)
    .messages({
      "string.max": "Model cannot exceed 100 characters",
    }),
  manufacturer: Joi.string()
    .optional()
    .allow("", null)
    .max(100)
    .messages({
      "string.max": "Manufacturer cannot exceed 100 characters",
    }),
  barcode: Joi.string()
    .optional()
    .allow("", null)
    .max(100)
    .messages({
      "string.max": "Barcode cannot exceed 100 characters",
    }),
  image: Joi.string()
    .optional()
    .allow("", null)
    .messages({
      "string.base": "Image must be a string",
    }),
  description: Joi.string()
    .optional()
    .allow("", null)
    .max(1000)
    .messages({
      "string.max": "Description cannot exceed 1000 characters",
    }),
});

export const getProductsQuerySchema = Joi.object({
  search: Joi.string()
    .optional()
    .allow("")
    .messages({
      "string.base": "Search must be a string",
    }),
  category: Joi.string()
    .optional()
    .allow("")
    .messages({
      "string.base": "Category must be a string",
    }),
  lowStock: Joi.string()
    .optional()
    .valid("true", "false")
    .messages({
      "any.only": "Low stock must be 'true' or 'false'",
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

