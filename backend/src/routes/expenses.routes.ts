import express, { Router } from "express";
import expenseController from "../controllers/expense.controller";
import { authenticate } from "../middleware/auth";
import { validate, validateQuery, validateParams } from "../middleware/validate";
import {
  createExpenseSchema,
  updateExpenseSchema,
  getExpensesQuerySchema,
} from "../validators/expense.validator";
import Joi from "joi";

const router = Router();

// Get all expenses
router.get(
  "/",
  authenticate,
  validateQuery(getExpensesQuerySchema),
  expenseController.getExpenses.bind(expenseController)
);

// Get single expense
router.get(
  "/:id",
  authenticate,
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "Expense ID must be a valid UUID",
        "any.required": "Expense ID is required",
      }),
    })
  ),
  expenseController.getExpense.bind(expenseController)
);

// Create expense
router.post(
  "/",
  authenticate,
  validate(createExpenseSchema),
  expenseController.createExpense.bind(expenseController)
);

// Update expense
router.put(
  "/:id",
  authenticate,
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "Expense ID must be a valid UUID",
        "any.required": "Expense ID is required",
      }),
    })
  ),
  validate(updateExpenseSchema),
  expenseController.updateExpense.bind(expenseController)
);

// Delete expense
router.delete(
  "/:id",
  authenticate,
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "Expense ID must be a valid UUID",
        "any.required": "Expense ID is required",
      }),
    })
  ),
  expenseController.deleteExpense.bind(expenseController)
);

export default router;
