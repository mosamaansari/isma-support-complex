import { Router } from "express";
import { query } from "express-validator";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// Get sales report
router.get(
  "/sales",
  authenticate,
  [query("startDate").optional().isISO8601(), query("endDate").optional().isISO8601()],
  async (req: AuthRequest, res) => {
    try {
      const { startDate, endDate } = req.query;

      const where: any = { status: "completed" };

      if (startDate && endDate) {
        where.createdAt = {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        };
      }

      const sales = await prisma.sale.findMany({
        where,
        include: {
          items: true,
        },
      });

      const totalSales = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
      const totalBills = sales.length;

      res.json({
        sales,
        summary: {
          totalSales,
          totalBills,
          averageBill: totalBills > 0 ? totalSales / totalBills : 0,
        },
      });
    } catch (error) {
      logger.error("Get sales report error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Get expenses report
router.get(
  "/expenses",
  authenticate,
  [query("startDate").optional().isISO8601(), query("endDate").optional().isISO8601()],
  async (req: AuthRequest, res) => {
    try {
      const { startDate, endDate } = req.query;

      const where: any = {};

      if (startDate && endDate) {
        where.date = {
          gte: new Date(startDate as string),
          lte: new Date(endDate as string),
        };
      }

      const expenses = await prisma.expense.findMany({
        where,
      });

      const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

      // Group by category
      const categoryTotals = expenses.reduce((acc, exp) => {
        acc[exp.category] = (acc[exp.category] || 0) + Number(exp.amount);
        return acc;
      }, {} as Record<string, number>);

      res.json({
        expenses,
        summary: {
          totalExpenses,
          categoryTotals,
        },
      });
    } catch (error) {
      logger.error("Get expenses report error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Get profit/loss report
router.get(
  "/profit-loss",
  authenticate,
  [query("startDate").optional().isISO8601(), query("endDate").optional().isISO8601()],
  async (req: AuthRequest, res) => {
    try {
      const { startDate, endDate } = req.query;

      const dateFilter: any = {};
      if (startDate && endDate) {
        dateFilter.gte = new Date(startDate as string);
        dateFilter.lte = new Date(endDate as string);
      }

      // Get sales
      const sales = await prisma.sale.findMany({
        where: {
          status: "completed",
          createdAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
        },
      });

      // Get expenses
      const expenses = await prisma.expense.findMany({
        where: {
          date: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
        },
      });

      const totalSales = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
      const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
      const profit = totalSales - totalExpenses;

      res.json({
        totalSales,
        totalExpenses,
        profit,
        profitMargin: totalSales > 0 ? (profit / totalSales) * 100 : 0,
        period: {
          startDate: startDate || null,
          endDate: endDate || null,
        },
      });
    } catch (error) {
      logger.error("Get profit/loss report error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;

