import express, { Router } from "express";
import bankAccountController from "../controllers/bankAccount.controller";
import { authenticate, authorize } from "../middleware/auth";
import { validate, validateParams } from "../middleware/validate";
import { createBankAccountSchema, updateBankAccountSchema } from "../validators/bankAccount.validator";
import Joi from "joi";

const router = Router();

// Get all bank accounts
router.get("/", authenticate, bankAccountController.getBankAccounts.bind(bankAccountController));

// Get default bank account
router.get("/default", authenticate, bankAccountController.getDefaultBankAccount.bind(bankAccountController));

// Get single bank account
router.get(
  "/:id",
  authenticate,
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "Bank account ID must be a valid UUID",
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
  authorize("superadmin", "admin"),
  validate(createBankAccountSchema),
  bankAccountController.createBankAccount.bind(bankAccountController)
);

// Update bank account
router.put(
  "/:id",
  authenticate,
  authorize("superadmin", "admin"),
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "Bank account ID must be a valid UUID",
        "any.required": "Bank account ID is required",
      }),
    })
  ),
  validate(updateBankAccountSchema),
  bankAccountController.updateBankAccount.bind(bankAccountController)
);

// Delete bank account
router.delete(
  "/:id",
  authenticate,
  authorize("superadmin", "admin"),
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "Bank account ID must be a valid UUID",
        "any.required": "Bank account ID is required",
      }),
    })
  ),
  bankAccountController.deleteBankAccount.bind(bankAccountController)
);

export default router;


