import express, { Router } from "express";
import categoryController from "../controllers/category.controller";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { bodyValidator, paramsValidator } from "../middleware/joiValidator";
import { createCategorySchema, updateCategorySchema } from "../validators/category.validator";
import { PERMISSIONS } from "../utils/permissions";
import Joi from "joi";

const router = Router();

// Get all categories
router.get("/", authenticate, requirePermission(PERMISSIONS.PRODUCTS_VIEW), categoryController.getCategories.bind(categoryController));

// Get single category
router.get(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_VIEW),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Category ID is required",
        "any.required": "Category ID is required",
      }),
    })
  ),
  categoryController.getCategory.bind(categoryController)
);

// Create category
router.post(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_CREATE),
  bodyValidator(createCategorySchema),
  categoryController.createCategory.bind(categoryController)
);

// Update category
router.put(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_UPDATE),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Category ID is required",
        "any.required": "Category ID is required",
      }),
    })
  ),
  bodyValidator(updateCategorySchema),
  categoryController.updateCategory.bind(categoryController)
);

// Delete category
router.delete(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_DELETE),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Category ID is required",
        "any.required": "Category ID is required",
      }),
    })
  ),
  categoryController.deleteCategory.bind(categoryController)
);

export default router;
