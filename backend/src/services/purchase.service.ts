import prisma from "../config/database";
import logger from "../utils/logger";
import productService from "./product.service";
import { validateTodayDate } from "../utils/dateValidation";
import { limitDecimalPlaces } from "../utils/numberHelpers";

const splitPurchaseQuantities = (item: {
  quantity: number;
  shopQuantity?: number;
  warehouseQuantity?: number;
  toWarehouse?: boolean;
  productId?: string;
}) => {
  const rawShop = Number(item.shopQuantity ?? 0);
  const rawWarehouse = Number(item.warehouseQuantity ?? 0);
  const splitTotal = rawShop + rawWarehouse;

  const fallbackTotal = Number(item.quantity || 0);
  const totalQuantity = splitTotal > 0 ? splitTotal : fallbackTotal;

  if (!Number.isFinite(totalQuantity) || totalQuantity <= 0) {
    throw new Error(`Quantity must be greater than 0 for product ${item.productId || ""}`);
  }

  const shopQuantity =
    splitTotal > 0
      ? rawShop
      : item.toWarehouse === false
        ? totalQuantity
        : 0;

  const warehouseQuantity =
    splitTotal > 0
      ? rawWarehouse
      : item.toWarehouse === false
        ? 0
        : totalQuantity;

  return {
    shopQuantity,
    warehouseQuantity,
    totalQuantity: shopQuantity + warehouseQuantity,
  };
};

class PurchaseService {
  async getPurchases(filters: {
    startDate?: string;
    endDate?: string;
    supplierId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const where: any = {};

    if (filters.startDate && filters.endDate) {
      where.date = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate),
      };
    }

    if (filters.supplierId) {
      where.supplierId = filters.supplierId;
    }

    const page = filters.page || 1;
    const pageSize = filters.pageSize || 10;
    const skip = (page - 1) * pageSize;

    try {
      const [purchases, total] = await Promise.all([
        prisma.purchase.findMany({
          where,
          include: {
            items: {
              include: {
                product: true,
              },
            },
            supplier: true,
            // Note: user relation removed - userId and userName are stored directly
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: pageSize,
        }),
        prisma.purchase.count({ where }),
      ]);

      return {
        data: purchases,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    } catch (error: any) {
      throw error;
    }
  }

  async createPurchase(
    data: {
      supplierName: string;
      supplierPhone?: string;
      items: Array<{
        productId: string;
        quantity: number;
        cost: number;
        priceType?: "single" | "dozen";
        costSingle?: number;
        costDozen?: number;
        discount?: number;
        discountType?: "percent" | "value";
        toWarehouse?: boolean;
        shopQuantity?: number;
        warehouseQuantity?: number;
      }>;
      subtotal: number;
      discount?: number;
      discountType?: "percent" | "value";
      tax?: number;
      taxType?: "percent" | "value";
      total: number;
      payments: Array<{
        type: "cash" | "card" | "bank_transfer";
        amount: number;
        cardId?: string;
        bankAccountId?: string;
      }>;
      date?: string;
    },
    userId: string,
    userType?: "user" | "admin"
  ) {
    // Validate that date is today (if provided)
    validateTodayDate(data.date, 'purchase date');

    // Get or create supplier based on name + phone combination
    const supplierPhone = data.supplierPhone || "";
    // Get or create supplier by name + phone (case-insensitive)
    let supplier = await prisma.supplier.findFirst({
      where: {
        name: { equals: data.supplierName, mode: "insensitive" },
        phone: supplierPhone,
      },
    });

    if (!supplier) {
      supplier = await prisma.supplier.create({
        data: {
          name: data.supplierName,
          phone: supplierPhone,
        },
      });
    }

    // Calculate total and prepare items
    const purchaseItems = [];

    for (const item of data.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      // Quantity normalization:
      // Support both payload styles:
      // - Preferred (current frontend): quantities already in units, and costSingle is provided
      // - Legacy/alternate: priceType=dozen, qty fields represent dozens (so multiply by 12)
      const qtyMultiplier =
        (item.priceType === "dozen" && (item.costSingle === undefined || item.costSingle === null) && (item.costDozen !== undefined && item.costDozen !== null))
          ? 12
          : 1;

      const itemForSplit = {
        ...item,
        quantity: Number(item.quantity || 0) * qtyMultiplier,
        shopQuantity: item.shopQuantity !== undefined ? Number(item.shopQuantity) * qtyMultiplier : undefined,
        warehouseQuantity: item.warehouseQuantity !== undefined ? Number(item.warehouseQuantity) * qtyMultiplier : undefined,
      };

      const { shopQuantity, warehouseQuantity, totalQuantity } = splitPurchaseQuantities(itemForSplit);

      // Normalize price fields:
      // - cost is always treated as per-unit (single) cost for calculations
      // - also store costSingle + costDozen and the selected priceType for UI/reporting
      const priceType: "single" | "dozen" = (item.priceType as any) || "single";
      let costSingle =
        item.costSingle !== undefined && item.costSingle !== null
          ? Number(item.costSingle)
          : Number(item.cost || 0);
      let costDozen =
        item.costDozen !== undefined && item.costDozen !== null
          ? Number(item.costDozen)
          : Number(costSingle * 12);

      if (priceType === "dozen") {
        // If dozen price was entered, derive single price when missing
        if (item.costDozen !== undefined && item.costDozen !== null) {
          costDozen = Number(item.costDozen);
          if (!(item.costSingle !== undefined && item.costSingle !== null)) {
            costSingle = costDozen / 12;
          }
        } else {
          // Dozen mode but dozen missing: derive from single
          costDozen = costSingle * 12;
        }
      } else {
        // Single mode: ensure dozen is derived
        costDozen = costDozen || costSingle * 12;
      }

      const unitCost = limitDecimalPlaces(costSingle || 0);
      const itemSubtotal = limitDecimalPlaces(unitCost * totalQuantity);

      // Calculate discount based on type
      const discount = item.discount || 0;
      const discountType = item.discountType || "percent";
      let itemDiscount = 0;
      if (discount > 0) {
        if (discountType === "value") {
          itemDiscount = limitDecimalPlaces(discount);
        } else {
          itemDiscount = limitDecimalPlaces((itemSubtotal * discount) / 100);
        }
      }

      const itemTotal = limitDecimalPlaces(itemSubtotal - itemDiscount);

      purchaseItems.push({
        productId: product.id,
        productName: product.name,
        quantity: totalQuantity,
        shopQuantity,
        warehouseQuantity,
        cost: unitCost,
        priceType,
        costSingle: unitCost,
        costDozen,
        discount: item.discount || 0,
        discountType: discountType,
        total: itemTotal,
        toWarehouse: warehouseQuantity > 0 && shopQuantity === 0 ? true : item.toWarehouse ?? false,
      });
    }

    // Get user - check both AdminUser and User tables
    let user: any = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, username: true },
    });

    let finalUserType: "user" | "admin" = "user";

    // If not found in User table, check AdminUser table
    if (!user) {
      const adminUser = await prisma.adminUser.findUnique({
        where: { id: userId },
        select: { id: true, name: true, username: true },
      });
      if (adminUser) {
        user = adminUser;
        finalUserType = "admin";
      }
    }

    if (!user) {
      throw new Error("User not found");
    }

    // Use provided userType if available, otherwise use detected type
    const userTypeToUse = userType || finalUserType;

    // Add current date and time to all payments
    const currentDateTime = new Date().toISOString();
    const paymentsWithDate = data.payments.map((payment: any) => ({
      ...payment,
      date: currentDateTime // Always use current date and time
    }));

    // Calculate total paid amount
    const totalPaid = paymentsWithDate.reduce((sum, payment) => sum + payment.amount, 0);
    const remainingBalance = data.total - totalPaid;

    if (totalPaid > data.total) {
      throw new Error("Total paid amount cannot exceed total amount");
    }

    // Check balance BEFORE creating purchase
    const balanceManagementService = (await import("./balanceManagement.service")).default;
    const currentDate = new Date();

    for (const payment of data.payments) {
      // Skip invalid payments
      if (!payment.amount || payment.amount <= 0 || isNaN(Number(payment.amount))) {
        continue;
      }

      const amount = Number(payment.amount);

      if (payment.type === "cash") {
        const currentBalance = await balanceManagementService.getCurrentCashBalance(currentDate);
        if (currentBalance < amount) {
          throw new Error(`Insufficient cash balance. Available: ${currentBalance.toFixed(2)}, Required: ${amount.toFixed(2)}`);
        }
      } else if ((payment.type === "bank_transfer" || payment.type === "card") && payment.bankAccountId) {
        const currentBalance = await balanceManagementService.getCurrentBankBalance(payment.bankAccountId, currentDate);
        if (currentBalance < amount) {
          throw new Error(`Insufficient bank balance for account. Available: ${currentBalance.toFixed(2)}, Required: ${amount.toFixed(2)}`);
        }
      }
    }

    // Set status based on remaining balance
    const status = remainingBalance > 0 ? "pending" : "completed";

    // Create purchase with items (store name and phone, not supplierId)
    const purchase = await prisma.purchase.create({
      data: {
        // Don't set supplierId, just store name and phone
        supplierName: data.supplierName,
        supplierPhone: data.supplierPhone || null,
        subtotal: data.subtotal,
        discount: data.discount || 0,
        discountType: data.discountType || "percent",
        tax: data.tax || 0,
        taxType: data.taxType || "percent",
        total: data.total,
        payments: paymentsWithDate as any,
        remainingBalance: remainingBalance,
        status: status as any,
        date: new Date(), // Always use current date/time
        userId: user.id,
        userName: user.name,
        createdBy: user.id,
        createdByType: userTypeToUse,
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

    // Update product quantities (shop or warehouse)
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      const purchaseItem = purchaseItems[i];
      const updateData: any = {};

      const productForUpdate = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (productForUpdate) {
        if ("warehouseQuantity" in productForUpdate && purchaseItem.warehouseQuantity > 0) {
          updateData.warehouseQuantity = { increment: purchaseItem.warehouseQuantity };
        }
        if ("shopQuantity" in productForUpdate && purchaseItem.shopQuantity > 0) {
          updateData.shopQuantity = { increment: purchaseItem.shopQuantity };
        }
        if (!("shopQuantity" in productForUpdate) && !("warehouseQuantity" in productForUpdate)) {
          updateData.quantity = { increment: purchaseItem.quantity };
        }

        const updatedProduct = await prisma.product.update({
          where: { id: item.productId },
          data: updateData,
        });

        // Reset low-stock notification flag if stock recovered
        await productService.checkAndNotifyLowStock(updatedProduct.id);
      }
    }

    // Update supplier totals and due amount
    await prisma.supplier.update({
      where: { id: supplier.id },
      data: {
        totalPurchases: {
          increment: data.total,
        },
        dueAmount: {
          increment: remainingBalance,
        },
      },
    });

    // Update balances atomically for payments using balance management service
    // Balance already validated above, now update after successful purchase creation
    for (const payment of data.payments) {
      // Skip payments with invalid amounts
      if (!payment.amount || payment.amount <= 0 || isNaN(Number(payment.amount))) {
        logger.warn(`Skipping invalid payment amount: ${payment.amount} for purchase ${purchase.id}`);
        continue;
      }

      const amount = Number(payment.amount);

      try {
        // Purchase payments can be cash, card, or bank_transfer
        if (payment.type === "cash") {
          await balanceManagementService.updateCashBalance(
            purchase.date,
            amount,
            "expense",
            {
              description: `Purchase - ${data.supplierName}`,
              source: "purchase_payment",
              sourceId: purchase.id,
              userId: user.id,
              userName: user.name,
            }
          );
          logger.info(`Updated cash balance: -${amount} for purchase ${purchase.id}`);
        } else if (payment.type === "bank_transfer" && payment.bankAccountId) {
          // Bank transfer payments in purchases
          await balanceManagementService.updateBankBalance(
            payment.bankAccountId,
            purchase.date,
            amount,
            "expense",
            {
              description: `Purchase - ${data.supplierName}`,
              source: "purchase_payment",
              sourceId: purchase.id,
              userId: user.id,
              userName: user.name,
            }
          );
          logger.info(`Updated bank balance: -${amount} for purchase ${purchase.id}, bank: ${payment.bankAccountId}`);
        } else if (payment.type === "card" && (payment.cardId || payment.bankAccountId)) {
          // Card payments in purchases
          const cardId = payment.cardId || payment.bankAccountId;
          if (cardId) {
            await balanceManagementService.updateCardBalance(
              cardId,
              purchase.date,
              amount,
              "expense",
              {
                description: `Purchase - ${data.supplierName} (Card)`,
                source: "purchase_payment",
                sourceId: purchase.id,
                userId: user.id,
                userName: user.name,
              }
            );
            logger.info(`Updated card balance: -${amount} for purchase ${purchase.id}, card: ${cardId}`);
          }
        } else if ((payment.type === "bank_transfer" || payment.type === "card") && !payment.bankAccountId && !payment.cardId) {
          logger.warn(`Skipping ${payment.type} payment without account ID for purchase ${purchase.id}`);
        }
      } catch (error: any) {
        logger.error(`Error updating balance for payment type ${payment.type} in purchase ${purchase.id}:`, error);

        // Rollback: Delete the created purchase since balance update failed
        try {
          await prisma.purchase.delete({
            where: { id: purchase.id },
          });
          logger.info(`Rolled back purchase creation for ${purchase.id} due to balance error`);
        } catch (deleteError) {
          logger.error(`Failed to rollback purchase ${purchase.id}:`, deleteError);
        }

        // Re-throw to ensure the error is propagated
        throw new Error(`${error.message}`);
      }
    }

    return purchase;
  }

  async getPurchase(id: string) {
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        supplier: true,
        // Note: user relation removed - userId and userName are stored directly
      },
    });

    if (!purchase) {
      throw new Error("Purchase not found");
    }

    // Convert Decimals to numbers for easier frontend handling (and provide price defaults)
    return {
      ...purchase,
      subtotal: Number(purchase.subtotal),
      discount: Number(purchase.discount),
      tax: Number(purchase.tax),
      total: Number(purchase.total),
      remainingBalance: Number(purchase.remainingBalance),
      discountType: purchase.discountType || "percent",
      taxType: purchase.taxType || "percent",
      items: purchase.items.map((item: any) => {
        const cost = Number(item.cost);
        const costSingle = item.costSingle !== undefined && item.costSingle !== null ? Number(item.costSingle) : cost;
        const costDozen =
          item.costDozen !== undefined && item.costDozen !== null ? Number(item.costDozen) : costSingle * 12;
        return {
          ...item,
          cost: costSingle, // keep per-unit cost
          priceType: item.priceType || "single",
          costSingle,
          costDozen,
          discount: Number(item.discount || 0),
          discountType: item.discountType || "percent",
          total: Number(item.total),
        };
      }),
    };
  }

  async updatePurchase(
    id: string,
    data: {
      supplierName?: string;
      supplierPhone?: string;
      items?: Array<{
        productId: string;
        quantity: number;
        cost: number;
        priceType?: "single" | "dozen";
        costSingle?: number;
        costDozen?: number;
        discount?: number;
        discountType?: "percent" | "value";
        toWarehouse?: boolean;
        shopQuantity?: number;
        warehouseQuantity?: number;
      }>;
      subtotal?: number;
      discount?: number;
      discountType?: "percent" | "value";
      tax?: number;
      taxType?: "percent" | "value";
      total?: number;
      payments?: Array<{
        type: "cash" | "card" | "bank_transfer";
        amount: number;
        cardId?: string;
        bankAccountId?: string;
      }>;
      date?: string;
    },
    userId: string
  ) {
    // Validate that date is today (if provided)
    validateTodayDate(data.date, 'purchase date');

    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: { items: true, supplier: true },
    });

    if (!purchase) {
      throw new Error("Purchase not found");
    }

    // Prevent edits on completed purchases
    if (purchase.status === "completed") {
      throw new Error("Completed purchases cannot be edited");
    }

    const updateData: any = {};

    // Update supplier if name changed
    // Update supplier name/phone (store in purchase, not linked via ID)
    if (data.supplierName) {
      updateData.supplierName = data.supplierName;
      // Don't set supplierId, just store name and phone (supplierId is optional)
    }
    if (data.supplierPhone !== undefined) {
      updateData.supplierPhone = data.supplierPhone || null;
    }

    // Maintain supplier table for listing (name + phone unique)
    if (data.supplierName) {
      const supplierPhone = data.supplierPhone || "";
      const existing = await prisma.supplier.findFirst({
        where: {
          name: { equals: data.supplierName, mode: "insensitive" },
          phone: supplierPhone,
        },
      });

      if (!existing) {
        await prisma.supplier.create({
          data: {
            name: data.supplierName,
            phone: supplierPhone,
          },
        });
      }
    }

    // Update items if provided, adjusting stock differences
    if (data.items) {
      // 1) Revert old stock
      for (const oldItem of purchase.items) {
        const product: any = await prisma.product.findUnique({ where: { id: oldItem.productId } });
        if (product) {
          const revertShopQty = Number(
            (oldItem as any).shopQuantity ??
            (oldItem.toWarehouse === false ? oldItem.quantity : 0)
          );
          const revertWarehouseQty = Number(
            (oldItem as any).warehouseQuantity ??
            (oldItem.toWarehouse === false ? 0 : oldItem.quantity)
          );

          if (revertWarehouseQty > 0) {
            await prisma.product.update({
              where: { id: product.id },
              data: { warehouseQuantity: { decrement: revertWarehouseQty } },
            });
          }

          if (revertShopQty > 0) {
            await prisma.product.update({
              where: { id: product.id },
              data: { shopQuantity: { decrement: revertShopQty } },
            });
          }

          if (!("shopQuantity" in product) && !("warehouseQuantity" in product)) {
            await prisma.product.update({
              where: { id: product.id },
              data: { quantity: { decrement: oldItem.quantity } } as any,
            });
          }
        }
      }

      // Delete old items
      await prisma.purchaseItem.deleteMany({
        where: { purchaseId: id },
      });

      // 2) Create new items and apply stock increments
      const purchaseItems: any[] = [];
      for (const item of data.items) {
        const product: any = await prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        const qtyMultiplier =
          (item.priceType === "dozen" && (item.costSingle === undefined || item.costSingle === null) && (item.costDozen !== undefined && item.costDozen !== null))
            ? 12
            : 1;

        const itemForSplit = {
          ...item,
          quantity: Number(item.quantity || 0) * qtyMultiplier,
          shopQuantity: item.shopQuantity !== undefined ? Number(item.shopQuantity) * qtyMultiplier : undefined,
          warehouseQuantity: item.warehouseQuantity !== undefined ? Number(item.warehouseQuantity) * qtyMultiplier : undefined,
        };

        const { shopQuantity, warehouseQuantity, totalQuantity } = splitPurchaseQuantities(itemForSplit);

        // Normalize price fields (same rules as createPurchase)
        const priceType: "single" | "dozen" = (item.priceType as any) || "single";
        let costSingle =
          item.costSingle !== undefined && item.costSingle !== null
            ? Number(item.costSingle)
            : Number(item.cost || 0);
        let costDozen =
          item.costDozen !== undefined && item.costDozen !== null
            ? Number(item.costDozen)
            : Number(costSingle * 12);

        if (priceType === "dozen") {
          if (item.costDozen !== undefined && item.costDozen !== null) {
            costDozen = Number(item.costDozen);
            if (!(item.costSingle !== undefined && item.costSingle !== null)) {
              costSingle = costDozen / 12;
            }
          } else {
            costDozen = costSingle * 12;
          }
        } else {
          costDozen = costDozen || costSingle * 12;
        }

        const unitCost = Number(costSingle || 0);
        const itemSubtotal = unitCost * totalQuantity;

        // Calculate discount based on type
        const discount = item.discount || 0;
        const discountType = item.discountType || "percent";
        let itemDiscount = 0;
        if (discount > 0) {
          if (discountType === "value") {
            itemDiscount = discount;
          } else {
            itemDiscount = (itemSubtotal * discount) / 100;
          }
        }

        const itemTotal = itemSubtotal - itemDiscount;

        purchaseItems.push({
          productId: product.id,
          productName: product.name,
          quantity: totalQuantity,
          shopQuantity,
          warehouseQuantity,
          cost: unitCost,
          priceType,
          costSingle: unitCost,
          costDozen,
          discount: item.discount || 0,
          discountType: discountType,
          total: itemTotal,
          toWarehouse: warehouseQuantity > 0 && shopQuantity === 0 ? true : item.toWarehouse ?? false,
        });

        // Apply stock increment based on destination
        if (warehouseQuantity > 0) {
          await prisma.product.update({
            where: { id: product.id },
            data: { warehouseQuantity: { increment: warehouseQuantity } },
          });
        }
        if (shopQuantity > 0) {
          await prisma.product.update({
            where: { id: product.id },
            data: { shopQuantity: { increment: shopQuantity } },
          });
        }
        if (!("shopQuantity" in product) && !("warehouseQuantity" in product)) {
          await prisma.product.update({
            where: { id: product.id },
            data: { quantity: { increment: totalQuantity } } as any,
          });
        }
      }

      updateData.items = {
        create: purchaseItems,
      };
    }

    // Update totals
    if (data.subtotal !== undefined) updateData.subtotal = data.subtotal;
    if (data.discount !== undefined) updateData.discount = data.discount;
    if (data.discountType !== undefined) updateData.discountType = data.discountType;
    if (data.tax !== undefined) updateData.tax = data.tax;
    if (data.taxType !== undefined) updateData.taxType = data.taxType;
    if (data.total !== undefined) updateData.total = data.total;
    if (data.payments) {
      updateData.payments = data.payments as any;
      // Recalculate remaining balance
      const totalPaid = data.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const purchaseTotal = data.total !== undefined ? Number(data.total) : Number(purchase.total);
      if (totalPaid > purchaseTotal) {
        throw new Error("Total paid amount cannot exceed total amount");
      }
      updateData.remainingBalance = purchaseTotal - totalPaid;
    }
    // Don't allow date updates - always use current date
    // if (data.date) updateData.date = new Date(data.date);

    const updatedPurchase = await prisma.purchase.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        supplier: true,
      },
    });

    // Convert Decimals to numbers for easier frontend handling (and provide price defaults)
    return {
      ...updatedPurchase,
      subtotal: Number(updatedPurchase.subtotal),
      discount: Number(updatedPurchase.discount),
      tax: Number(updatedPurchase.tax),
      total: Number(updatedPurchase.total),
      remainingBalance: Number(updatedPurchase.remainingBalance),
      discountType: updatedPurchase.discountType || "percent",
      taxType: updatedPurchase.taxType || "percent",
      items: updatedPurchase.items.map((item: any) => {
        const cost = Number(item.cost);
        const costSingle = item.costSingle !== undefined && item.costSingle !== null ? Number(item.costSingle) : cost;
        const costDozen =
          item.costDozen !== undefined && item.costDozen !== null ? Number(item.costDozen) : costSingle * 12;
        return {
          ...item,
          cost: costSingle,
          priceType: item.priceType || "single",
          costSingle,
          costDozen,
          discount: Number(item.discount || 0),
          discountType: item.discountType || "percent",
          total: Number(item.total),
        };
      }),
    };
  }

  async addPaymentToPurchase(
    purchaseId: string,
    payment: {
      type: "cash" | "card" | "bank_transfer";
      amount: number;
      cardId?: string;
      bankAccountId?: string;
      date?: string;
    },
    userId: string,
    userType?: "user" | "admin"
  ) {
    // Validate that date is today (if provided)
    validateTodayDate(payment.date, 'payment date');

    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
    });

    if (!purchase) {
      throw new Error("Purchase not found");
    }

    if (purchase.status === "cancelled") {
      throw new Error("Cannot add payment to a cancelled purchase");
    }
    if (purchase.status === "completed") {
      throw new Error("Cannot add payment to a completed purchase");
    }

    const currentPayments = (purchase.payments as any) || [];
    // Always use current date and time for new payment
    const newPayments = [...currentPayments, { ...payment, date: new Date().toISOString() }];
    const totalPaid = newPayments.reduce((sum, p: any) => sum + Number(p.amount), 0);
    const remainingBalance = Number(purchase.total) - totalPaid;

    if (totalPaid > Number(purchase.total)) {
      throw new Error("Total paid amount cannot exceed total amount");
    }

    if (remainingBalance < 0) {
      throw new Error("Payment amount exceeds remaining balance");
    }

    // Update status based on remaining balance
    const newStatus = remainingBalance <= 0 ? "completed" : "pending";

    const updatedPurchase = await prisma.purchase.update({
      where: { id: purchaseId },
      data: {
        payments: newPayments as any,
        remainingBalance: remainingBalance,
        status: newStatus as any,
        updatedBy: userId,
        updatedByType: userType || null,
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

    // Update balances atomically for the new payment using balance management service
    try {
      const balanceManagementService = (await import("./balanceManagement.service")).default;

      // Get user info
      let user: any = null;
      let userName = "System";
      if (userId) {
        user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, username: true },
        });
        if (!user) {
          const adminUser = await prisma.adminUser.findUnique({
            where: { id: userId },
            select: { id: true, name: true, username: true },
          });
          if (adminUser) {
            user = adminUser;
          }
        }
        if (user) {
          userName = user.name || user.username || "System";
        }
      }

      // Skip invalid payments
      if (!payment.amount || payment.amount <= 0 || isNaN(Number(payment.amount))) {
        logger.warn(`Skipping invalid payment amount: ${payment.amount} for purchase ${purchase.id}`);
      } else {
        const paymentDate = payment.date ? new Date(payment.date) : purchase.date;
        const amount = Number(payment.amount);

        // Update balance for cash, bank_transfer, or card payments
        if (payment.type === "cash") {
          await balanceManagementService.updateCashBalance(
            paymentDate,
            amount,
            "expense",
            {
              description: `Purchase Payment - ${purchase.supplierName}`,
              source: "purchase_payment",
              sourceId: purchase.id,
              userId: userId,
              userName: userName,
            }
          );
          logger.info(`Updated cash balance: -${amount} for purchase payment ${purchase.id}`);
        } else if (payment.type === "bank_transfer" && payment.bankAccountId) {
          await balanceManagementService.updateBankBalance(
            payment.bankAccountId,
            paymentDate,
            amount,
            "expense",
            {
              description: `Purchase Payment - ${purchase.supplierName}`,
              source: "purchase_payment",
              sourceId: purchase.id,
              userId: userId,
              userName: userName,
            }
          );
          logger.info(`Updated bank balance: -${amount} for purchase payment ${purchase.id}, bank: ${payment.bankAccountId}`);
        } else if (payment.type === "card" && (payment.cardId || payment.bankAccountId)) {
          const cardId = payment.cardId || payment.bankAccountId;
          if (cardId) {
            await balanceManagementService.updateCardBalance(
              cardId,
              paymentDate,
              amount,
              "expense",
              {
                description: `Purchase Payment - ${purchase.supplierName} (Card)`,
                source: "purchase_payment",
                sourceId: purchase.id,
                userId: userId,
                userName: userName,
              }
            );
            logger.info(`Updated card balance: -${amount} for purchase payment ${purchase.id}, card: ${cardId}`);
          }
        } else if ((payment.type === "bank_transfer" || payment.type === "card") && !payment.bankAccountId && !payment.cardId) {
          logger.warn(`Skipping ${payment.type} payment without account ID for purchase ${purchase.id}`);
        }
      }
    } catch (error: any) {
      logger.error("Error updating balance for purchase payment:", error);
      // Re-throw to ensure the error is propagated
      throw new Error(`${error.message}`);
    }

    // Supplier table is maintained for listing only, not linked to purchases via ID

    return updatedPurchase;
  }
}

export default new PurchaseService();

