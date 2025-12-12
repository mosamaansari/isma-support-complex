import express, { Router } from "express";
import { body, validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// Get all purchases
router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate, supplierId } = req.query;

    const where: any = {};

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    if (supplierId) {
      where.supplierId = supplierId as string;
    }

    const purchases = await prisma.purchase.findMany({
      where,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        supplier: true,
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

    res.json(purchases);
  } catch (error) {
    logger.error("Get purchases error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create purchase
router.post(
  "/",
  authenticate,
  authorize("superadmin", "admin", "warehouse_manager"),
  [
    body("supplierName").notEmpty().withMessage("Supplier name is required"),
    body("items").isArray().notEmpty().withMessage("Items are required"),
    body("items.*.productId").notEmpty().withMessage("Product ID is required"),
    body("items.*.quantity").isInt({ min: 1 }).withMessage("Quantity must be at least 1"),
    body("items.*.cost").isNumeric().withMessage("Cost must be a number"),
  ],
  async (req: AuthRequest, res: express.Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { supplierName, items, date } = req.body;

      // Get or create supplier
      let supplier = await prisma.supplier.findFirst({
        where: { name: { equals: supplierName, mode: "insensitive" } },
      });

      if (!supplier) {
        supplier = await prisma.supplier.create({
          data: { 
            name: supplierName,
            phone: "",
          },
        });
      }

      // Calculate total and prepare items
      let total = 0;
      const purchaseItems = [];

      for (const item of items) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          return res.status(404).json({ error: `Product ${item.productId} not found` });
        }

        const itemTotal = parseFloat(item.cost) * parseInt(item.quantity);
        total += itemTotal;

        purchaseItems.push({
          productId: product.id,
          productName: product.name,
          quantity: parseInt(item.quantity),
          cost: parseFloat(item.cost),
          total: itemTotal,
        });
      }

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Create purchase with items
      const purchase = await prisma.purchase.create({
        data: {
          supplierId: supplier.id,
          supplierName: supplier.name,
          total,
          date: date ? new Date(date) : new Date(),
          userId: user.id,
          userName: user.name,
          items: {
            create: purchaseItems,
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          supplier: true,
        },
      });

      // Update product quantities and costs
      for (const item of items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            quantity: {
              increment: parseInt(item.quantity),
            },
            cost: parseFloat(item.cost), // Update cost
          },
        });
      }

      // Update supplier totals
      await prisma.supplier.update({
        where: { id: supplier.id },
        data: {
          totalPurchases: {
            increment: total,
          },
        },
      });

      logger.info(`Purchase created: ${purchase.id} by ${user.username}`);
      res.status(201).json(purchase);
    } catch (error) {
      logger.error("Create purchase error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;

