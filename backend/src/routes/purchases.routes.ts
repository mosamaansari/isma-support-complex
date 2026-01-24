import express, { Router } from "express";
import purchaseController from "../controllers/purchase.controller";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { bodyValidator, queryValidator, paramsValidator } from "../middleware/joiValidator";
import {
  createPurchaseSchema,
  updatePurchaseSchema,
  addPaymentSchema,
  getPurchasesQuerySchema,
} from "../validators/purchase.validator";
import { PERMISSIONS } from "../utils/permissions";
import Joi from "joi";

const router = Router();

// Get all purchases
router.get(
  "/",
  authenticate,
  queryValidator(getPurchasesQuerySchema),
  purchaseController.getPurchases.bind(purchaseController)
);

// Get single purchase
router.get(
  "/:id",
  authenticate,
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Purchase ID cannot be empty",
        "string.min": "Purchase ID cannot be empty",
        "any.required": "Purchase ID is required",
      }),
    })
  ),
  purchaseController.getPurchase.bind(purchaseController)
);

// Create purchase
router.post(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.PURCHASES_CREATE),
  bodyValidator(createPurchaseSchema),
  purchaseController.createPurchase.bind(purchaseController)
);

// Update purchase
router.put(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.PURCHASES_UPDATE),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Purchase ID cannot be empty",
        "string.min": "Purchase ID cannot be empty",
        "any.required": "Purchase ID is required",
      }),
    })
  ),
  bodyValidator(updatePurchaseSchema),
  purchaseController.updatePurchase.bind(purchaseController)
);

// Cancel purchase
router.patch(
  "/:id/cancel",
  authenticate,
  requirePermission(PERMISSIONS.PURCHASES_CANCEL),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Purchase ID is required",
        "string.min": "Purchase ID is required",
        "any.required": "Purchase ID is required",
      }),
    })
  ),
  bodyValidator(
    Joi.object({
      refundMethod: Joi.string()
        .valid("cash", "bank_transfer", "card")
        .optional()
        .messages({
          "any.only": "Refund method must be either 'cash', 'bank_transfer', or 'card'",
        }),
      bankAccountId: Joi.string()
        .optional()
        .when("refundMethod", {
          is: "bank_transfer",
          then: Joi.required().messages({
            "any.required": "Bank account ID is required when refund method is bank_transfer",
          }),
          otherwise: Joi.optional(),
        }),
      cardId: Joi.string()
        .optional()
        .when("refundMethod", {
          is: "card",
          then: Joi.required().messages({
            "any.required": "Card ID is required when refund method is card",
          }),
          otherwise: Joi.optional(),
        }),
    })
  ),
  purchaseController.cancelPurchase.bind(purchaseController)
);

// Add payment to existing purchase
router.post(
  "/:id/payments",
  authenticate,
  requirePermission(PERMISSIONS.PURCHASES_ADD_PAYMENT),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Purchase ID cannot be empty",
        "string.min": "Purchase ID cannot be empty",
        "any.required": "Purchase ID is required",
      }),
    })
  ),
  bodyValidator(addPaymentSchema),
  purchaseController.addPayment.bind(purchaseController)
);

export default router;
