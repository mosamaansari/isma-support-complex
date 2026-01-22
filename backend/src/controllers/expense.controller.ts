import { Request, Response } from "express";
import expenseService from "../services/expense.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class ExpenseController {
  async getExpenses(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate, category, search, page, pageSize } = req.query;
      const filters = {
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        category: category as string | undefined,
        search: search as string | undefined,
        page: page ? parseInt(page as string) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string) : undefined,
      };
      const result = await expenseService.getExpenses(filters);
      return res.status(200).json({
        message: "Expenses retrieved successfully",
        response: result,
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get expenses error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async getExpense(req: AuthRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const expense = await expenseService.getExpense(id);
      return res.status(200).json({
        message: "Expense retrieved successfully",
        response: {
          data: expense,
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get expense error:", error);
      if (error instanceof Error && error.message === "Expense not found") {
        return res.status(404).json({
          message: "Expense not found",
          response: null,
          error: "Expense not found",
        });
      }
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async createExpense(req: AuthRequest, res: Response) {
    try {
      const expense = await expenseService.createExpense(req.body, req.user!.id, req.user?.userType);
      logger.info(`Expense created: ${expense.id} by ${req.user?.username}`);
      return res.status(201).json({
        message: "Expense created successfully",
        response: {
          data: expense,
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Create expense error:", error);
      if (error instanceof Error && error.message === "User not found") {
        return res.status(404).json({
          message: "User not found",
          response: null,
          error: "User not found",
        });
      }
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async updateExpense(req: AuthRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const canModify = await expenseService.canUserModify(
        id,
        req.user!.id,
        req.user!.role
      );

      if (!canModify) {
        return res.status(403).json({
          message: "Not authorized to update this expense",
          response: null,
          error: "Not authorized to update this expense",
        });
      }

      const expense = await expenseService.updateExpense(id, req.body);
      logger.info(`Expense updated: ${expense.id} by ${req.user?.username}`);
      return res.status(200).json({
        message: "Expense updated successfully",
        response: {
          data: expense,
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Update expense error:", error);
      if (error instanceof Error && error.message === "Expense not found") {
        return res.status(404).json({
          message: "Expense not found",
          response: null,
          error: "Expense not found",
        });
      }
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async deleteExpense(req: AuthRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const canModify = await expenseService.canUserModify(
        id,
        req.user!.id,
        req.user!.role
      );

      if (!canModify) {
        return res.status(403).json({
          message: "Not authorized to delete this expense",
          response: null,
          error: "Not authorized to delete this expense",
        });
      }

      await expenseService.deleteExpense(id);
      logger.info(`Expense deleted: ${id} by ${req.user?.username}`);
      return res.status(200).json({
        message: "Expense deleted successfully",
        response: {
          data: null,
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Delete expense error:", error);
      if (error instanceof Error && error.message === "Expense not found") {
        return res.status(404).json({
          message: "Expense not found",
          response: null,
          error: "Expense not found",
        });
      }
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async getExpenseStatistics(req: AuthRequest, res: Response) {
    try {
      const [allTimeTotals, categoryTotals] = await Promise.all([
        expenseService.getAllTimeTotals(),
        expenseService.getCategoryTotals(),
      ]);

      return res.status(200).json({
        message: "Expense statistics retrieved successfully",
        response: {
          data: {
            allTimeTotals,
            categoryTotals,
          },
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get expense statistics error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }
}

export default new ExpenseController();


