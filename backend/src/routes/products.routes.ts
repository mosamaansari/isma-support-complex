import express, { Router } from "express";
import { body, validationResult, query } from "express-validator";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// Get all products
router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const { search, category, lowStock } = req.query;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { category: { contains: search as string, mode: "insensitive" } },
      ];
    }

    if (category) {
      where.category = { contains: category as string, mode: "insensitive" };
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    if (lowStock === "true") {
      const lowStockProducts = products.filter(
        (p) => p.quantity <= p.minStockLevel
      );
      return res.json(lowStockProducts);
    }

    res.json(products);
  } catch (error) {
    logger.error("Get products error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get single product
router.get("/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
    });

    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    logger.error("Get product error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create product
router.post(
  "/",
  authenticate,
  authorize("superadmin", "admin", "warehouse_manager"),
  [
    body("name").notEmpty().withMessage("Product name is required"),
    body("category").notEmpty().withMessage("Category is required"),
    body("cost").isNumeric().withMessage("Cost must be a number"),
    body("salePrice").isNumeric().withMessage("Sale price must be a number"),
    body("quantity").isInt().withMessage("Quantity must be an integer"),
    body("minStockLevel").isInt().withMessage("Min stock level must be an integer"),
  ],
  async (req: AuthRequest, res: express.Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Try to find category by name, or use categoryId if provided
      let categoryId = null;
      if (req.body.categoryId) {
        categoryId = req.body.categoryId;
      } else if (req.body.category) {
        const category = await prisma.category.findUnique({
          where: { name: req.body.category },
        });
        if (category) {
          categoryId = category.id;
        }
      }

      const product = await prisma.product.create({
        data: {
          name: req.body.name,
          category: req.body.category,
          categoryId: categoryId,
          cost: parseFloat(req.body.cost),
          salePrice: parseFloat(req.body.salePrice),
          quantity: parseInt(req.body.quantity),
          minStockLevel: parseInt(req.body.minStockLevel),
          barcode: req.body.barcode,
          image: req.body.image,
        },
      });

      logger.info(`Product created: ${product.name} by ${req.user?.username}`);
      res.status(201).json(product);
    } catch (error) {
      logger.error("Create product error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Update product
router.put(
  "/:id",
  authenticate,
  authorize("superadmin", "admin", "warehouse_manager"),
  async (req: AuthRequest, res: express.Response) => {
    try {
      // Try to find category by name, or use categoryId if provided
      let categoryId = undefined;
      if (req.body.categoryId) {
        categoryId = req.body.categoryId;
      } else if (req.body.category) {
        const category = await prisma.category.findUnique({
          where: { name: req.body.category },
        });
        if (category) {
          categoryId = category.id;
        }
      }

      const updateData: any = {
        name: req.body.name,
        category: req.body.category,
        cost: req.body.cost ? parseFloat(req.body.cost) : undefined,
        salePrice: req.body.salePrice ? parseFloat(req.body.salePrice) : undefined,
        quantity: req.body.quantity ? parseInt(req.body.quantity) : undefined,
        minStockLevel: req.body.minStockLevel ? parseInt(req.body.minStockLevel) : undefined,
        barcode: req.body.barcode,
        image: req.body.image,
      };

      if (categoryId !== undefined) {
        updateData.categoryId = categoryId;
      }

      const product = await prisma.product.update({
        where: { id: req.params.id },
        data: updateData,
      });

      logger.info(`Product updated: ${product.name} by ${req.user?.username}`);
      res.json(product);
    } catch (error) {
      logger.error("Update product error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Delete product
router.delete(
  "/:id",
  authenticate,
  authorize("superadmin", "admin", "warehouse_manager"),
  async (req: AuthRequest, res: express.Response) => {
    try {
      await prisma.product.delete({
        where: { id: req.params.id },
      });

      logger.info(`Product deleted: ${req.params.id} by ${req.user?.username}`);
      res.json({ message: "Product deleted successfully" });
    } catch (error) {
      logger.error("Delete product error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Get low stock products
router.get("/inventory/low-stock", authenticate, async (req: AuthRequest, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        quantity: {
          lte: prisma.product.fields.minStockLevel,
        },
      },
    });

    res.json(products);
  } catch (error) {
    logger.error("Get low stock products error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

