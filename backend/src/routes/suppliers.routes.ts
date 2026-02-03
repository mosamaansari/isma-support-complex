import express, { Router } from "express";
import supplierController from "../controllers/supplier.controller";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { queryValidator } from "../middleware/joiValidator";
import { PERMISSIONS } from "../utils/permissions";
import Joi from "joi";

const router = Router();

// Get all suppliers (for dropdown/autocomplete)
router.get(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.PURCHASES_VIEW),
  queryValidator(
    Joi.object({
      search: Joi.string()
        .optional()
        .allow("")
        .messages({
          "string.base": "Search must be a string",
        }),
    })
  ),
  supplierController.getSuppliers.bind(supplierController)
);

export default router;
