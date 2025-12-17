import express, { Router } from "express";
import openingBalanceController from "../controllers/openingBalance.controller";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { bodyValidator, queryValidator, paramsValidator } from "../middleware/joiValidator";
import {
  createOpeningBalanceSchema,
  updateOpeningBalanceSchema,
  getOpeningBalancesQuerySchema,
} from "../validators/openingBalance.validator";
import { PERMISSIONS } from "../utils/permissions";
import Joi from "joi";

const router = Router();

// Get opening balance for a specific date
router.get(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.OPENING_BALANCE_VIEW),
  queryValidator(getOpeningBalancesQuerySchema),
  openingBalanceController.getOpeningBalances.bind(openingBalanceController)
);

// Get opening balance for a specific date
router.get(
  "/date",
  authenticate,
  requirePermission(PERMISSIONS.OPENING_BALANCE_VIEW),
  queryValidator(
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
  requirePermission(PERMISSIONS.OPENING_BALANCE_CREATE),
  bodyValidator(createOpeningBalanceSchema),
  openingBalanceController.createOpeningBalance.bind(openingBalanceController)
);

// Update opening balance
router.put(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.OPENING_BALANCE_UPDATE),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Opening balance ID is required",
        "any.required": "Opening balance ID is required",
      }),
    })
  ),
  bodyValidator(updateOpeningBalanceSchema),
  openingBalanceController.updateOpeningBalance.bind(openingBalanceController)
);

// Delete opening balance
router.delete(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.OPENING_BALANCE_DELETE),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Opening balance ID is required",
        "any.required": "Opening balance ID is required",
      }),
    })
  ),
  openingBalanceController.deleteOpeningBalance.bind(openingBalanceController)
);

export default router;

