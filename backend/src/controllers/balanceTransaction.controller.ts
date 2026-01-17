import { Response } from "express";
import balanceTransactionService from "../services/balanceTransaction.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class BalanceTransactionController {
  async getTransactions(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate, paymentType, bankAccountId, type } = req.query;
      const filters = {
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        paymentType: paymentType as "cash" | "bank_transfer" | undefined,
        bankAccountId: bankAccountId as string | undefined,
        type: type as "income" | "expense" | undefined,
      };
      const transactions = await balanceTransactionService.getTransactions(filters);
      return res.status(200).json({
        message: "Transactions retrieved successfully",
        response: {
          data: transactions,
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get transactions error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async getCashTransactions(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate, excludeRefunds } = req.query;
      const transactions = await balanceTransactionService.getCashTransactions(
        startDate as string | undefined,
        endDate as string | undefined,
        excludeRefunds === "true" || excludeRefunds === true
      );
      return res.status(200).json({
        message: "Cash transactions retrieved successfully",
        response: {
          data: transactions,
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get cash transactions error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async getBankTransactions(req: AuthRequest, res: Response) {
    try {
      const { bankAccountId, startDate, endDate, excludeRefunds } = req.query;
      if (!bankAccountId) {
        return res.status(400).json({
          message: "Bank account ID is required",
          response: null,
          error: "Bank account ID is required",
        });
      }
      const transactions = await balanceTransactionService.getBankTransactions(
        bankAccountId as string,
        startDate as string | undefined,
        endDate as string | undefined,
        excludeRefunds === "true" || excludeRefunds === true
      );
      return res.status(200).json({
        message: "Bank transactions retrieved successfully",
        response: {
          data: transactions,
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get bank transactions error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async getAllTransactionsGroupedByDay(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate, excludeRefunds } = req.query;
      const grouped = await balanceTransactionService.getAllTransactionsGroupedByDay(
        startDate as string | undefined,
        endDate as string | undefined,
        excludeRefunds === "true" || excludeRefunds === true
      );
      return res.status(200).json({
        message: "Transactions grouped by day retrieved successfully",
        response: {
          data: grouped,
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get grouped transactions error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }
}

export default new BalanceTransactionController();

