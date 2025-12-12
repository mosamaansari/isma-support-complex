import { Router } from "express";
import { body, validationResult, query } from "express-validator";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// Get all sales
router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate, status, search } = req.query;

    const where: any = {};

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { billNumber: { contains: search as string, mode: "insensitive" } },
        { customerName: { contains: search as string, mode: "insensitive" } },
        { customerPhone: { contains: search as string } },
      ];
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        customer: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(sales);
  } catch (error) {
    logger.error("Get sales error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get single sale
router.get("/:id", authenticate, async (req: AuthRequest, res) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        customer: true,
      },
    });

    if (!sale) {
      return res.status(404).json({ error: "Sale not found" });
    }

    res.json(sale);
  } catch (error) {
    logger.error("Get sale error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get sale by bill number
router.get("/bill/:billNumber", authenticate, async (req: AuthRequest, res) => {
  try {
    const sale = await prisma.sale.findUnique({
      where: { billNumber: req.params.billNumber },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        customer: true,
      },
    });

    if (!sale) {
      return res.status(404).json({ error: "Sale not found" });
    }

    res.json(sale);
  } catch (error) {
    logger.error("Get sale by bill number error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create sale
router.post(
  "/",
  authenticate,
  authorize("superadmin", "admin", "cashier"),
  [
    body("items").isArray().notEmpty().withMessage("Items are required"),
    body("items.*.productId").notEmpty().withMessage("Product ID is required"),
    body("items.*.quantity").isInt({ min: 1 }).withMessage("Quantity must be at least 1"),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { items, customerName, customerPhone, paymentType, discount, tax } = req.body;

      // Generate bill number
      const today = new Date();
      const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");
      const count = await prisma.sale.count({
        where: {
          billNumber: {
            startsWith: `BILL-${dateStr}`,
          },
        },
      });
      const billNumber = `BILL-${dateStr}-${String(count + 1).padStart(4, "0")}`;

      // Calculate totals
      let subtotal = 0;
      const saleItems = [];

      for (const item of items) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          return res.status(404).json({ error: `Product ${item.productId} not found` });
        }

        if (product.quantity < item.quantity) {
          return res.status(400).json({
            error: `Insufficient stock for ${product.name}. Available: ${product.quantity}`,
          });
        }

        const itemSubtotal = product.salePrice * item.quantity;
        const itemDiscount = (itemSubtotal * (item.discount || 0)) / 100;
        const itemTax = (itemSubtotal * (tax || 0)) / 100;
        const itemTotal = itemSubtotal - itemDiscount + itemTax;

        subtotal += itemSubtotal;

        saleItems.push({
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: product.salePrice,
          discount: item.discount || 0,
          tax: itemTax,
          total: itemTotal,
        });
      }

      const discountAmount = (subtotal * (discount || 0)) / 100;
      const taxAmount = (subtotal * (tax || 0)) / 100;
      const total = subtotal - discountAmount + taxAmount;

      // Get or create customer
      let customerId = null;
      if (customerPhone) {
        let customer = await prisma.customer.findFirst({
          where: { phone: customerPhone },
        });

        if (!customer && customerName) {
          customer = await prisma.customer.create({
            data: {
              name: customerName,
              phone: customerPhone,
            },
          });
        }

        if (customer) {
          customerId = customer.id;
        }
      }

      // Get user
      const user = await prisma.user.findUnique({
        where: { id: req.user!.id },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Create sale with items
      const sale = await prisma.sale.create({
        data: {
          billNumber,
          subtotal,
          discount: discountAmount,
          tax: taxAmount,
          total,
          paymentType: paymentType || "cash",
          customerId,
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          userId: user.id,
          userName: user.name,
          items: {
            create: saleItems,
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Update product quantities
      for (const item of items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            quantity: {
              decrement: parseInt(item.quantity),
            },
          },
        });
      }

      logger.info(`Sale created: ${billNumber} by ${user.username}`);
      res.status(201).json(sale);
    } catch (error) {
      logger.error("Create sale error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Cancel sale
router.patch(
  "/:id/cancel",
  authenticate,
  authorize("superadmin", "admin"),
  async (req: AuthRequest, res) => {
    try {
      const sale = await prisma.sale.findUnique({
        where: { id: req.params.id },
        include: { items: true },
      });

      if (!sale) {
        return res.status(404).json({ error: "Sale not found" });
      }

      if (sale.status === "cancelled") {
        return res.status(400).json({ error: "Sale already cancelled" });
      }

      // Restore product quantities
      for (const item of sale.items) {
        await prisma.product.update({
          where: { id: item.productId },
          data: {
            quantity: {
              increment: item.quantity,
            },
          },
        });
      }

      // Update sale status
      const updatedSale = await prisma.sale.update({
        where: { id: req.params.id },
        data: { status: "cancelled" },
      });

      logger.info(`Sale cancelled: ${sale.billNumber} by ${req.user?.username}`);
      res.json(updatedSale);
    } catch (error) {
      logger.error("Cancel sale error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;

