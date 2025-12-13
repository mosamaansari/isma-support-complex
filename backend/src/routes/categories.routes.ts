import express, { Router } from "express";
import categoryController from "../controllers/category.controller";
import { authenticate } from "../middleware/auth";
import { validate, validateParams } from "../middleware/validate";
import { createCategorySchema, updateCategorySchema } from "../validators/category.validator";
import Joi from "joi";

const router = Router();

// Get all categories
router.get("/", authenticate, categoryController.getCategories.bind(categoryController));

// Get single category
router.get(
  "/:id",
  authenticate,
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "Category ID must be a valid UUID",
        "any.required": "Category ID is required",
      }),
    })
  ),
  categoryController.getCategory.bind(categoryController)
);

// Create category (all authenticated users can create)
router.post(
  "/",
  authenticate,
  validate(createCategorySchema),
  categoryController.createCategory.bind(categoryController)
);

// Update category
router.put(
  "/:id",
  authenticate,
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "Category ID must be a valid UUID",
        "any.required": "Category ID is required",
      }),
    })
  ),
  validate(updateCategorySchema),
  categoryController.updateCategory.bind(categoryController)
);

// Delete category
router.delete(
  "/:id",
  authenticate,
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "Category ID must be a valid UUID",
        "any.required": "Category ID is required",
      }),
    })
  ),
  categoryController.deleteCategory.bind(categoryController)
);

export default router;
