import express, { Router } from "express";
import openingBalanceController from "../controllers/openingBalance.controller";
import { authenticate, authorize } from "../middleware/auth";
import { validate, validateQuery, validateParams } from "../middleware/validate";
import {
  createOpeningBalanceSchema,
  updateOpeningBalanceSchema,
  getOpeningBalancesQuerySchema,
} from "../validators/openingBalance.validator";
import Joi from "joi";

const router = Router();

// Get opening balance for a specific date
router.get(
  "/",
  authenticate,
  validateQuery(getOpeningBalancesQuerySchema),
  openingBalanceController.getOpeningBalances.bind(openingBalanceController)
);

// Get opening balance for a specific date
router.get(
  "/date",
  authenticate,
  validateQuery(
    Joi.object({
      date: Joi.string().required().isoDate().messages({
        "string.isoDate": "Date must be a valid ISO date",
        "any.required": "Date is required",
      }),
    })
  ),
  openingBalanceController.getOpeningBalance.bind(openingBalanceController)
);

// Create opening balance
router.post(
  "/",
  authenticate,
  authorize("superadmin", "admin", "cashier"),
  validate(createOpeningBalanceSchema),
  openingBalanceController.createOpeningBalance.bind(openingBalanceController)
);

// Update opening balance
router.put(
  "/:id",
  authenticate,
  authorize("superadmin", "admin", "cashier"),
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "Opening balance ID must be a valid UUID",
        "any.required": "Opening balance ID is required",
      }),
    })
  ),
  validate(updateOpeningBalanceSchema),
  openingBalanceController.updateOpeningBalance.bind(openingBalanceController)
);

// Delete opening balance
router.delete(
  "/:id",
  authenticate,
  authorize("superadmin", "admin"),
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "Opening balance ID must be a valid UUID",
        "any.required": "Opening balance ID is required",
      }),
    })
  ),
  openingBalanceController.deleteOpeningBalance.bind(openingBalanceController)
);

export default router;

