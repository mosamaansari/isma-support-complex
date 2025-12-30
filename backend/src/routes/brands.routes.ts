import express, { Router } from "express";
import brandController from "../controllers/brand.controller";
import { authenticate } from "../middleware/auth";
import { bodyValidator, paramsValidator } from "../middleware/joiValidator";
import { createBrandSchema, updateBrandSchema } from "../validators/brand.validator";
import Joi from "joi";

const router = Router();

// Get all brands
router.get("/", authenticate, brandController.getBrands.bind(brandController));

// Get single brand
router.get(
  "/:id",
  authenticate,
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Brand ID is required",
        "any.required": "Brand ID is required",
      }),
    })
  ),
  brandController.getBrand.bind(brandController)
);

// Create brand (all authenticated users can create)
router.post(
  "/",
  authenticate,
  bodyValidator(createBrandSchema),
  brandController.createBrand.bind(brandController)
);

// Update brand
router.put(
  "/:id",
  authenticate,
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Brand ID is required",
        "any.required": "Brand ID is required",
      }),
    })
  ),
  bodyValidator(updateBrandSchema),
  brandController.updateBrand.bind(brandController)
);

// Delete brand
router.delete(
  "/:id",
  authenticate,
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Brand ID is required",
        "any.required": "Brand ID is required",
      }),
    })
  ),
  brandController.deleteBrand.bind(brandController)
);

export default router;







