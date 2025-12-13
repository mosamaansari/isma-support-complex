import { Request, Response } from "express";
import expenseService from "../services/expense.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class ExpenseController {
  async getExpenses(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate, category, search } = req.query;
      const filters = {
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        category: category as string | undefined,
        search: search as string | undefined,
      };
      const expenses = await expenseService.getExpenses(filters);
      res.json(expenses);
    } catch (error: any) {
      logger.error("Get expenses error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getExpense(req: AuthRequest, res: Response) {
    try {
      const expense = await expenseService.getExpense(req.params.id);
      res.json(expense);
    } catch (error: any) {
      logger.error("Get expense error:", error);
      if (error.message === "Expense not found") {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async createExpense(req: AuthRequest, res: Response) {
    try {
      const expense = await expenseService.createExpense(req.body, req.user!.id);
      logger.info(`Expense created: ${expense.id} by ${req.user?.username}`);
      res.status(201).json(expense);
    } catch (error: any) {
      logger.error("Create expense error:", error);
      if (error.message === "User not found") {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async updateExpense(req: AuthRequest, res: Response) {
    try {
      const canModify = await expenseService.canUserModify(
        req.params.id,
        req.user!.id,
        req.user!.role
      );

      if (!canModify) {
        return res.status(403).json({ error: "Not authorized to update this expense" });
      }

      const expense = await expenseService.updateExpense(req.params.id, req.body);
      logger.info(`Expense updated: ${expense.id} by ${req.user?.username}`);
      res.json(expense);
    } catch (error: any) {
      logger.error("Update expense error:", error);
      if (error.message === "Expense not found") {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async deleteExpense(req: AuthRequest, res: Response) {
    try {
      const canModify = await expenseService.canUserModify(
        req.params.id,
        req.user!.id,
        req.user!.role
      );

      if (!canModify) {
        return res.status(403).json({ error: "Not authorized to delete this expense" });
      }

      await expenseService.deleteExpense(req.params.id);
      logger.info(`Expense deleted: ${req.params.id} by ${req.user?.username}`);
      res.json({ message: "Expense deleted successfully" });
    } catch (error: any) {
      logger.error("Delete expense error:", error);
      if (error.message === "Expense not found") {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }
}

export default new ExpenseController();


