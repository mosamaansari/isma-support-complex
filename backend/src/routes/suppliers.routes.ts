import express, { Router } from "express";
import supplierController from "../controllers/supplier.controller";
import { authenticate } from "../middleware/auth";
import { queryValidator } from "../middleware/joiValidator";
import Joi from "joi";

const router = Router();

// Get all suppliers (for dropdown/autocomplete)
router.get(
  "/",
  authenticate,
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




