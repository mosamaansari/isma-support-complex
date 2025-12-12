import express, { Router } from "express";
import { body, validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// Get all categories
router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
    });

    res.json(categories);
  } catch (error) {
    logger.error("Get categories error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get single category
router.get("/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const category = await prisma.category.findUnique({
      where: { id: req.params.id },
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    res.json(category);
  } catch (error) {
    logger.error("Get category error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create category (all authenticated users can create)
router.post(
  "/",
  authenticate,
  [
    body("name").notEmpty().withMessage("Category name is required"),
  ],
  async (req: AuthRequest, res: express.Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Check if category already exists
      const existingCategory = await prisma.category.findUnique({
        where: { name: req.body.name },
      });

      if (existingCategory) {
        return res.status(400).json({ error: "Category already exists" });
      }

      const category = await prisma.category.create({
        data: {
          name: req.body.name.trim(),
          description: req.body.description?.trim() || null,
        },
      });

      logger.info(`Category created: ${category.name} by ${req.user?.username}`);
      res.status(201).json(category);
    } catch (error) {
      logger.error("Create category error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Update category
router.put(
  "/:id",
  authenticate,
  [
    body("name").notEmpty().withMessage("Category name is required"),
  ],
  async (req: AuthRequest, res: express.Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const category = await prisma.category.findUnique({
        where: { id: req.params.id },
      });

      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }

      // Check if name is being changed and if new name already exists
      if (req.body.name !== category.name) {
        const existingCategory = await prisma.category.findUnique({
          where: { name: req.body.name.trim() },
        });

        if (existingCategory) {
          return res.status(400).json({ error: "Category name already exists" });
        }
      }

      const updatedCategory = await prisma.category.update({
        where: { id: req.params.id },
        data: {
          name: req.body.name.trim(),
          description: req.body.description?.trim() || null,
        },
      });

      logger.info(`Category updated: ${updatedCategory.name} by ${req.user?.username}`);
      res.json(updatedCategory);
    } catch (error) {
      logger.error("Update category error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Delete category
router.delete("/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const category = await prisma.category.findUnique({
      where: { id: req.params.id },
      include: {
        products: true,
      },
    });

    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }

    // Check if category is being used by any products
    if (category.products.length > 0) {
      return res.status(400).json({
        error: `Cannot delete category. It is being used by ${category.products.length} product(s)`,
      });
    }

    await prisma.category.delete({
      where: { id: req.params.id },
    });

    logger.info(`Category deleted: ${category.name} by ${req.user?.username}`);
    res.json({ message: "Category deleted successfully" });
  } catch (error) {
    logger.error("Delete category error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

