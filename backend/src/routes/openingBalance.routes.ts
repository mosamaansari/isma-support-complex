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

const addToOpeningBalanceSchema = Joi.object({
  date: Joi.string().required().isoDate().messages({
    "string.isoDate": "Date must be a valid ISO date",
    "any.required": "Date is required",
  }),
  amount: Joi.number().required().positive().messages({
    "number.positive": "Amount must be greater than 0",
    "any.required": "Amount is required",
  }),
  type: Joi.string().required().valid("cash", "bank").messages({
    "any.only": "Type must be either 'cash' or 'bank'",
    "any.required": "Type is required",
  }),
  bankAccountId: Joi.string().when("type", {
    is: "bank",
    then: Joi.required().messages({
      "any.required": "Bank account ID is required when type is 'bank'",
    }),
    otherwise: Joi.optional(),
  }),
  description: Joi.string().optional().allow("", null),
});

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
      storedOnly: Joi.string().optional().valid("true", "false").messages({
        "any.only": "storedOnly must be either 'true' or 'false'",
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

// Manually trigger cron job to create opening balance (admin only)
router.get(
  "/trigger-cron",
  authenticate,
  requirePermission(PERMISSIONS.OPENING_BALANCE_CREATE),
  openingBalanceController.triggerCronJob.bind(openingBalanceController)
);

// Add to opening balance (creates opening balance if doesn't exist)
router.post(
  "/add",
  authenticate,
  requirePermission(PERMISSIONS.OPENING_BALANCE_CREATE),
  bodyValidator(addToOpeningBalanceSchema),
  openingBalanceController.addToOpeningBalance.bind(openingBalanceController)
);

export default router;
