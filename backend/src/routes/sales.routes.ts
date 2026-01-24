import express, { Router } from "express";
import saleController from "../controllers/sale.controller";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { bodyValidator, queryValidator, paramsValidator } from "../middleware/joiValidator";
import {
  createSaleSchema,
  getSalesQuerySchema,
  getSaleByBillNumberSchema,
} from "../validators/sale.validator";
import { PERMISSIONS } from "../utils/permissions";
import Joi from "joi";

const router = Router();

// Get all sales
router.get(
  "/",
  authenticate,
  queryValidator(getSalesQuerySchema),
  saleController.getSales.bind(saleController)
);

// Get sale by bill number (must be before /:id route)
router.get(
  "/bill/:billNumber",
  authenticate,
  paramsValidator(getSaleByBillNumberSchema),
  saleController.getSaleByBillNumber.bind(saleController)
);

// Get single sale
router.get(
  "/:id",
  authenticate,
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Sale ID is required",
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
  requirePermission(PERMISSIONS.SALES_CREATE),
  bodyValidator(createSaleSchema),
  saleController.createSale.bind(saleController)
);

// Cancel sale
router.patch(
  "/:id/cancel",
  authenticate,
  requirePermission(PERMISSIONS.SALES_CANCEL),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Sale ID is required",
        "any.required": "Sale ID is required",
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
  saleController.cancelSale.bind(saleController)
);

// Add payment to sale
router.post(
  "/:id/payments",
  authenticate,
  requirePermission(PERMISSIONS.SALES_ADD_PAYMENT),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Sale ID is required",
        "any.required": "Sale ID is required",
      }),
    })
  ),
  bodyValidator(
    Joi.object({
      type: Joi.string()
        .valid("cash", "card", "credit", "bank_transfer")
        .required()
        .messages({
          "any.only": "Payment type must be one of: cash, bank_transfer",
          "any.required": "Payment type is required",
        }),
      amount: Joi.number()
        .min(0)
        .optional()
        .allow(null)
        .messages({
          "number.base": "Payment amount must be a number",
          "number.min": "Payment amount cannot be negative",
        }),
      cardId: Joi.string()
        .optional()
        .allow("", null)
        .messages({
          "string.base": "Card ID must be a string",
        }),
      bankAccountId: Joi.string()
        .optional()
        .allow("", null)
        .messages({
          "string.base": "Bank account ID must be a string",
        }),
      date: Joi.string()
        .optional()
        .isoDate()
        .allow("", null)
        .messages({
          "string.isoDate": "Date must be a valid ISO date",
        }),
    })
  ),
  saleController.addPaymentToSale.bind(saleController)
);

export default router;
