import express, { Router } from "express";
import bankAccountController from "../controllers/bankAccount.controller";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { bodyValidator, paramsValidator } from "../middleware/joiValidator";
import { createBankAccountSchema, updateBankAccountSchema } from "../validators/bankAccount.validator";
import { PERMISSIONS } from "../utils/permissions";
import Joi from "joi";

const router = Router();

// Get all bank accounts
router.get("/", authenticate, requirePermission(PERMISSIONS.BANK_ACCOUNTS_VIEW), bankAccountController.getBankAccounts.bind(bankAccountController));

// Get default bank account
router.get("/default", authenticate, requirePermission(PERMISSIONS.BANK_ACCOUNTS_VIEW), bankAccountController.getDefaultBankAccount.bind(bankAccountController));

// Get single bank account
router.get(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.BANK_ACCOUNTS_VIEW),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Bank account ID is required",
        "any.required": "Bank account ID is required",
      }),
    })
  ),
  bankAccountController.getBankAccount.bind(bankAccountController)
);

// Create bank account
router.post(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.BANK_ACCOUNTS_CREATE),
  bodyValidator(createBankAccountSchema),
  bankAccountController.createBankAccount.bind(bankAccountController)
);

// Update bank account
router.put(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.BANK_ACCOUNTS_UPDATE),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Bank account ID is required",
        "any.required": "Bank account ID is required",
      }),
    })
  ),
  bodyValidator(updateBankAccountSchema),
  bankAccountController.updateBankAccount.bind(bankAccountController)
);

// Delete bank account
router.delete(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.BANK_ACCOUNTS_DELETE),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Bank account ID is required",
        "any.required": "Bank account ID is required",
      }),
    })
  ),
  bankAccountController.deleteBankAccount.bind(bankAccountController)
);

export default router;
