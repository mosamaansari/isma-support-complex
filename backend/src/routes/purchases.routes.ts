import express, { Router } from "express";
import purchaseController from "../controllers/purchase.controller";
import { authenticate, authorize } from "../middleware/auth";
import { validate, validateQuery, validateParams } from "../middleware/validate";
import {
  createPurchaseSchema,
  updatePurchaseSchema,
  addPaymentSchema,
  getPurchasesQuerySchema,
} from "../validators/purchase.validator";
import Joi from "joi";

const router = Router();

// Get all purchases
router.get(
  "/",
  authenticate,
  validateQuery(getPurchasesQuerySchema),
  purchaseController.getPurchases.bind(purchaseController)
);

// Get single purchase
router.get(
  "/:id",
  authenticate,
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "Purchase ID must be a valid UUID",
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
  authorize("superadmin", "admin", "warehouse_manager"),
  validate(createPurchaseSchema),
  purchaseController.createPurchase.bind(purchaseController)
);

// Update purchase
router.put(
  "/:id",
  authenticate,
  authorize("superadmin", "admin", "warehouse_manager"),
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "Purchase ID must be a valid UUID",
        "any.required": "Purchase ID is required",
      }),
    })
  ),
  validate(updatePurchaseSchema),
  purchaseController.updatePurchase.bind(purchaseController)
);

// Add payment to existing purchase
router.post(
  "/:id/payments",
  authenticate,
  authorize("superadmin", "admin", "warehouse_manager"),
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "Purchase ID must be a valid UUID",
        "any.required": "Purchase ID is required",
      }),
    })
  ),
  validate(addPaymentSchema),
  purchaseController.addPayment.bind(purchaseController)
);

export default router;
