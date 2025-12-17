import express, { Router } from "express";
import productController from "../controllers/product.controller";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { bodyValidator, queryValidator, paramsValidator } from "../middleware/joiValidator";
import {
  createProductSchema,
  updateProductSchema,
  getProductsQuerySchema,
} from "../validators/product.validator";
import { PERMISSIONS } from "../utils/permissions";
import Joi from "joi";

const router = Router();

// Get all products
router.get(
  "/",
  authenticate,
  queryValidator(getProductsQuerySchema),
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
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Product ID is required",
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
  requirePermission(PERMISSIONS.PRODUCTS_CREATE),
  bodyValidator(createProductSchema),
  productController.createProduct.bind(productController)
);

// Update product
router.put(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_UPDATE),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Product ID is required",
        "any.required": "Product ID is required",
      }),
    })
  ),
  bodyValidator(updateProductSchema),
  productController.updateProduct.bind(productController)
);

// Delete product
router.delete(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_DELETE),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Product ID is required",
        "any.required": "Product ID is required",
      }),
    })
  ),
  productController.deleteProduct.bind(productController)
);

export default router;
