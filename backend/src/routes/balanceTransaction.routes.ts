import express, { Router } from "express";
import balanceTransactionController from "../controllers/balanceTransaction.controller";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { PERMISSIONS } from "../utils/permissions";

const router = Router();

// Get all transactions
router.get(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.BALANCE_TRANSACTIONS_VIEW),
  balanceTransactionController.getTransactions.bind(balanceTransactionController)
);

// Get cash transactions
router.get(
  "/cash",
  authenticate,
  requirePermission(PERMISSIONS.BALANCE_TRANSACTIONS_VIEW),
  balanceTransactionController.getCashTransactions.bind(balanceTransactionController)
);

// Get bank account transactions
router.get(
  "/bank",
  authenticate,
  requirePermission(PERMISSIONS.BALANCE_TRANSACTIONS_VIEW),
  balanceTransactionController.getBankTransactions.bind(balanceTransactionController)
);

// Get all transactions grouped by day
router.get(
  "/grouped",
  authenticate,
  requirePermission(PERMISSIONS.BALANCE_TRANSACTIONS_VIEW),
  balanceTransactionController.getAllTransactionsGroupedByDay.bind(balanceTransactionController)
);

// Get current bank balance
router.get(
  "/bank-balance",
  authenticate,
  requirePermission(PERMISSIONS.BALANCE_TRANSACTIONS_VIEW),
  balanceTransactionController.getCurrentBankBalance.bind(balanceTransactionController)
);

export default router;

