import { Router } from "express";
import { body, validationResult, query } from "express-validator";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// Get all expenses
router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate, category, search } = req.query;

    const where: any = {};

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.description = { contains: search as string, mode: "insensitive" };
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
      orderBy: { date: "desc" },
    });

    res.json(expenses);
  } catch (error) {
    logger.error("Get expenses error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get single expense
router.get("/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const expense = await prisma.expense.findUnique({
      where: { id: req.params.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });

    if (!expense) {
      return res.status(404).json({ error: "Expense not found" });
    }

    res.json(expense);
  } catch (error) {
    logger.error("Get expense error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create expense
router.post(
  "/",
  authenticate,
  [
    body("amount").isNumeric().withMessage("Amount must be a number"),
    body("category").notEmpty().withMessage("Category is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("date").optional().isISO8601().withMessage("Date must be valid"),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const expense = await prisma.expense.create({
        data: {
          amount: parseFloat(req.body.amount),
          category: req.body.category,
          description: req.body.description,
          date: req.body.date ? new Date(req.body.date) : new Date(),
          userId: user.id,
          userName: user.name,
        },
      });

      logger.info(`Expense created: ${expense.id} by ${user.username}`);
      res.status(201).json(expense);
    } catch (error) {
      logger.error("Create expense error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Update expense
router.put(
  "/:id",
  authenticate,
  async (req: AuthRequest, res) => {
    try {
      const expense = await prisma.expense.findUnique({
        where: { id: req.params.id },
      });

      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }

      // Check if user can update (own expense or admin)
      if (expense.userId !== req.user!.id && req.user!.role !== "superadmin" && req.user!.role !== "admin") {
        return res.status(403).json({ error: "Not authorized to update this expense" });
      }

      const updatedExpense = await prisma.expense.update({
        where: { id: req.params.id },
        data: {
          amount: req.body.amount ? parseFloat(req.body.amount) : undefined,
          category: req.body.category,
          description: req.body.description,
          date: req.body.date ? new Date(req.body.date) : undefined,
        },
      });

      logger.info(`Expense updated: ${expense.id} by ${req.user?.username}`);
      res.json(updatedExpense);
    } catch (error) {
      logger.error("Update expense error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Delete expense
router.delete(
  "/:id",
  authenticate,
  async (req: AuthRequest, res) => {
    try {
      const expense = await prisma.expense.findUnique({
        where: { id: req.params.id },
      });

      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }

      // Check if user can delete (own expense or admin)
      if (expense.userId !== req.user!.id && req.user!.role !== "superadmin" && req.user!.role !== "admin") {
        return res.status(403).json({ error: "Not authorized to delete this expense" });
      }

      await prisma.expense.delete({
        where: { id: req.params.id },
      });

      logger.info(`Expense deleted: ${expense.id} by ${req.user?.username}`);
      res.json({ message: "Expense deleted successfully" });
    } catch (error) {
      logger.error("Delete expense error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;

