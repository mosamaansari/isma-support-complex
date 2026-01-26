import express from "express";
import expenseCategoryService from "../services/expenseCategory.service";
import { createExpenseCategorySchema, updateExpenseCategorySchema } from "../validators/expenseCategory.validator";
import { authenticate } from "../middleware/auth";

const router = express.Router();

// Get all expense categories
router.get("/", authenticate, async (req, res) => {
  try {
    const categories = await expenseCategoryService.getExpenseCategories();
    res.json(categories);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single expense category
router.get("/:id", authenticate, async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const category = await expenseCategoryService.getExpenseCategory(id);
    res.json(category);
  } catch (error: any) {
    res.status(404).json({ error: error.message });
  }
});

// Create expense category
router.post("/", authenticate, async (req, res) => {
  try {
    const { error, value } = createExpenseCategorySchema.validate(req.body, { abortEarly: false });
    if (error) {
      const errors: Record<string, string[]> = {};
      error.details.forEach((detail) => {
        const field = detail.path[0] as string;
        if (!errors[field]) {
          errors[field] = [];
        }
        errors[field].push(detail.message);
      });
      return res.status(400).json({ error: errors });
    }

    const category = await expenseCategoryService.createExpenseCategory(value);
    res.status(201).json(category);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Update expense category
router.put("/:id", authenticate, async (req, res) => {
  try {
    const { error, value } = updateExpenseCategorySchema.validate(req.body, { abortEarly: false });
    if (error) {
      const errors: Record<string, string[]> = {};
      error.details.forEach((detail) => {
        const field = detail.path[0] as string;
        if (!errors[field]) {
          errors[field] = [];
        }
        errors[field].push(detail.message);
      });
      return res.status(400).json({ error: errors });
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const category = await expenseCategoryService.updateExpenseCategory(id, value);
    res.json(category);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Delete expense category
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await expenseCategoryService.deleteExpenseCategory(id);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;

