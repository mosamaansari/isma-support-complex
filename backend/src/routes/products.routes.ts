import express, { Router } from "express";
import productController from "../controllers/product.controller";
import { authenticate, authorize } from "../middleware/auth";
import { validate, validateQuery } from "../middleware/validate";
import {
  createProductSchema,
  updateProductSchema,
  getProductsQuerySchema,
} from "../validators/product.validator";
import { validateParams } from "../middleware/validate";
import Joi from "joi";

const router = Router();

// Get all products
router.get(
  "/",
  authenticate,
  validateQuery(getProductsQuerySchema),
  productController.getProducts.bind(productController)
);

// Get low stock products
router.get(
  "/inventory/low-stock",
  authenticate,
  productController.getLowStockProducts.bind(productController)
);

// Get single product
router.get(
  "/:id",
  authenticate,
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "Product ID must be a valid UUID",
        "any.required": "Product ID is required",
      }),
    })
  ),
  productController.getProduct.bind(productController)
);

// Create product
router.post(
  "/",
  authenticate,
  authorize("superadmin", "admin", "warehouse_manager"),
  validate(createProductSchema),
  productController.createProduct.bind(productController)
);

// Update product
router.put(
  "/:id",
  authenticate,
  authorize("superadmin", "admin", "warehouse_manager"),
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "Product ID must be a valid UUID",
        "any.required": "Product ID is required",
      }),
    })
  ),
  validate(updateProductSchema),
  productController.updateProduct.bind(productController)
);

// Delete product
router.delete(
  "/:id",
  authenticate,
  authorize("superadmin", "admin", "warehouse_manager"),
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "Product ID must be a valid UUID",
        "any.required": "Product ID is required",
      }),
    })
  ),
  productController.deleteProduct.bind(productController)
);

export default router;
