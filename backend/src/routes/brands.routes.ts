import express, { Router } from "express";
import brandController from "../controllers/brand.controller";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { bodyValidator, paramsValidator } from "../middleware/joiValidator";
import { createBrandSchema, updateBrandSchema } from "../validators/brand.validator";
import { PERMISSIONS } from "../utils/permissions";
import Joi from "joi";

const router = Router();

// Get all brands
router.get("/", authenticate, requirePermission(PERMISSIONS.PRODUCTS_VIEW), brandController.getBrands.bind(brandController));

// Get single brand
router.get(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_VIEW),
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

// Create brand
router.post(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_CREATE),
  bodyValidator(createBrandSchema),
  brandController.createBrand.bind(brandController)
);

// Update brand
router.put(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.PRODUCTS_UPDATE),
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
  requirePermission(PERMISSIONS.PRODUCTS_DELETE),
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
