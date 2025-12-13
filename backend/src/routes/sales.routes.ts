import express, { Router } from "express";
import saleController from "../controllers/sale.controller";
import { authenticate, authorize } from "../middleware/auth";
import { validate, validateQuery, validateParams } from "../middleware/validate";
import {
  createSaleSchema,
  getSalesQuerySchema,
  getSaleByBillNumberSchema,
} from "../validators/sale.validator";
import Joi from "joi";

const router = Router();

// Get all sales
router.get(
  "/",
  authenticate,
  validateQuery(getSalesQuerySchema),
  saleController.getSales.bind(saleController)
);

// Get sale by bill number (must be before /:id route)
router.get(
  "/bill/:billNumber",
  authenticate,
  validateParams(getSaleByBillNumberSchema),
  saleController.getSaleByBillNumber.bind(saleController)
);

// Get single sale
router.get(
  "/:id",
  authenticate,
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "Sale ID must be a valid UUID",
        "any.required": "Sale ID is required",
      }),
    })
  ),
  saleController.getSale.bind(saleController)
);

// Create sale
router.post(
  "/",
  authenticate,
  authorize("superadmin", "admin", "cashier"),
  validate(createSaleSchema),
  saleController.createSale.bind(saleController)
);

// Cancel sale
router.patch(
  "/:id/cancel",
  authenticate,
  authorize("superadmin", "admin"),
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "Sale ID must be a valid UUID",
        "any.required": "Sale ID is required",
      }),
    })
  ),
  saleController.cancelSale.bind(saleController)
);

// Add payment to sale
router.post(
  "/:id/payments",
  authenticate,
  authorize("superadmin", "admin", "cashier"),
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "Sale ID must be a valid UUID",
        "any.required": "Sale ID is required",
      }),
    })
  ),
  validate(
    Joi.object({
      type: Joi.string()
        .valid("cash", "card", "credit", "bank_transfer")
        .required()
        .messages({
          "any.only": "Payment type must be one of: cash, card, credit, bank_transfer",
          "any.required": "Payment type is required",
        }),
      amount: Joi.number()
        .min(0)
        .required()
        .messages({
          "number.base": "Payment amount must be a number",
          "number.min": "Payment amount cannot be negative",
          "any.required": "Payment amount is required",
        }),
      cardId: Joi.string()
        .optional()
        .uuid()
        .allow("", null)
        .messages({
          "string.uuid": "Card ID must be a valid UUID",
        }),
      bankAccountId: Joi.string()
        .optional()
        .uuid()
        .allow("", null)
        .messages({
          "string.uuid": "Bank account ID must be a valid UUID",
        }),
    })
  ),
  saleController.addPaymentToSale.bind(saleController)
);

export default router;
