import express, { Router } from "express";
import categoryController from "../controllers/category.controller";
import { authenticate } from "../middleware/auth";
import { bodyValidator, paramsValidator } from "../middleware/joiValidator";
import { createCategorySchema, updateCategorySchema } from "../validators/category.validator";
import Joi from "joi";

const router = Router();

// Get all categories
router.get("/", authenticate, categoryController.getCategories.bind(categoryController));

// Get single category
router.get(
  "/:id",
  authenticate,
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

// Create category (all authenticated users can create)
router.post(
  "/",
  authenticate,
  bodyValidator(createCategorySchema),
  categoryController.createCategory.bind(categoryController)
);

// Update category
router.put(
  "/:id",
  authenticate,
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
