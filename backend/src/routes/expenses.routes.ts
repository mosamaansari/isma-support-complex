import express, { Router } from "express";
import expenseController from "../controllers/expense.controller";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { bodyValidator, queryValidator, paramsValidator } from "../middleware/joiValidator";
import {
  createExpenseSchema,
  updateExpenseSchema,
  getExpensesQuerySchema,
} from "../validators/expense.validator";
import { PERMISSIONS } from "../utils/permissions";
import Joi from "joi";

const router = Router();

// Get all expenses
router.get(
  "/",
  authenticate,
  queryValidator(getExpensesQuerySchema),
  expenseController.getExpenses.bind(expenseController)
);

// Get single expense
router.get(
  "/:id",
  authenticate,
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Expense ID is required",
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
  requirePermission(PERMISSIONS.EXPENSES_CREATE),
  bodyValidator(createExpenseSchema),
  expenseController.createExpense.bind(expenseController)
);

// Update expense
router.put(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.EXPENSES_UPDATE),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Expense ID is required",
        "any.required": "Expense ID is required",
      }),
    })
  ),
  bodyValidator(updateExpenseSchema),
  expenseController.updateExpense.bind(expenseController)
);

// Delete expense
router.delete(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.EXPENSES_DELETE),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Expense ID is required",
        "any.required": "Expense ID is required",
      }),
    })
  ),
  expenseController.deleteExpense.bind(expenseController)
);

// Get expense statistics (all-time totals and category grouping)
router.get(
  "/statistics/all-time",
  authenticate,
  expenseController.getExpenseStatistics.bind(expenseController)
);

export default router;
