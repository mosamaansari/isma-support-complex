import prisma from "../config/database";
import logger from "../utils/logger";
import productService from "./product.service";
import { validateTodayDate } from "../utils/dateValidation";
import { parseLocalISO, getCurrentLocalDateTime, formatDateToLocalISO, getTodayInPakistan, formatLocalYMD, parseLocalYMDForDB } from "../utils/date";
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

      // Don't round price early - round only the final result to avoid precision loss
      // Use unrounded costSingle for calculations, but round for storage
      const unitCostForCalc = costSingle || 0;
      // Multiply first, then round to avoid precision loss (e.g., 0.0833... * 24 = 2.0, not 0.08 * 24 = 1.92)
      const itemSubtotal = limitDecimalPlaces(unitCostForCalc * totalQuantity);
      // Round unitCost for storage consistency
      const unitCost = limitDecimalPlaces(unitCostForCalc);

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

    // Filter out payments with empty/undefined/null/0 amount - only process payments with actual amount
    const validPayments = (data.payments || []).filter((payment: any) => {
      const amount = payment.amount ?? 0;
      return amount !== null && amount !== undefined && !isNaN(Number(amount)) && Number(amount) > 0;
    });

    // Add current date and time to all valid payments
    const currentDateTime = new Date().toISOString();
    const paymentsWithDate = validPayments.map((payment: any) => ({
      ...payment,
      date: currentDateTime // Always use current date and time
    }));

    // Calculate total paid amount
    const totalPaid = paymentsWithDate.reduce((sum, payment) => sum + payment.amount, 0);
    const remainingBalance = data.total - totalPaid;

    if (totalPaid > data.total) {
      throw new Error("Total paid amount cannot exceed total amount");
    }

    // Check balance from daily closing balance BEFORE creating purchase
    const dailyClosingBalanceService = (await import("./dailyClosingBalance.service")).default;
    const { formatLocalYMD, parseLocalISO } = await import("../utils/date");
    
    // Use purchase date if provided, otherwise use current date
    // Use parseLocalISO to avoid timezone conversion issues
    const purchaseDate = data.date ? parseLocalISO(data.date) : new Date();
    const purchaseDateStr = formatLocalYMD(purchaseDate);
    console.log("purchaseDateStr", purchaseDateStr, "original date:", data.date);
    // Get or calculate closing balance for purchase date
    const closingBalance = await dailyClosingBalanceService.getClosingBalance(purchaseDateStr);

    for (const payment of data.payments || []) {
      // Skip invalid payments (allow 0, but skip null/undefined/NaN)
      const paymentAmount = payment.amount ?? 0;
      if (paymentAmount === null || paymentAmount === undefined || isNaN(Number(paymentAmount)) || paymentAmount < 0) {
        continue;
      }

      const amount = Number(paymentAmount);

      if (payment.type === "cash") {
        const availableCash = closingBalance?.cashBalance || 0;
        if (availableCash < amount) {
          throw new Error(`Insufficient cash balance. Available: ${availableCash.toFixed(2)}, Required: ${amount.toFixed(2)}`);
        }
      } else if (payment.type === "bank_transfer" && payment.bankAccountId) {
        const bankBalances = (closingBalance?.bankBalances || []) as Array<{ bankAccountId: string; balance: number }>;
        const bankBalance = bankBalances.find(b => b.bankAccountId === payment.bankAccountId);
        const availableBankBalance = bankBalance ? Number(bankBalance.balance) : 0;
        if (availableBankBalance < amount) {
          throw new Error(`Insufficient bank balance for account. Available: ${availableBankBalance.toFixed(2)}, Required: ${amount.toFixed(2)}`);
        }
      } else if (payment.type === "card" && (payment.cardId || payment.bankAccountId)) {
        const cardId = payment.cardId || payment.bankAccountId;
        const cardBalances = (closingBalance?.cardBalances || []) as Array<{ cardId: string; balance: number }>;
        const cardBalance = cardBalances.find(c => c.cardId === cardId);
        const availableCardBalance = cardBalance ? Number(cardBalance.balance) : 0;
        if (availableCardBalance < amount) {
          throw new Error(`Insufficient card balance. Available: ${availableCardBalance.toFixed(2)}, Required: ${amount.toFixed(2)}`);
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
        date: data.date ? parseLocalISO(data.date) : getCurrentLocalDateTime(), // Parse local ISO date or use current date/time
        createdAt: getCurrentLocalDateTime(),
        updatedAt: getCurrentLocalDateTime(),
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
    const balanceManagementService = (await import("./balanceManagement.service")).default;
    
    for (const payment of data.payments) {
      // Skip payments with invalid amounts
      if (!payment.amount || payment.amount <= 0 || isNaN(Number(payment.amount))) {
        logger.warn(`Skipping invalid payment amount: ${payment.amount} for purchase ${purchase.id}`);
        continue;
      }

      // Use payment date if available, otherwise use purchase date
      // Extract date components from payment/purchase date to avoid timezone issues
      const paymentOrPurchaseDate = (payment as any).date ? parseLocalISO((payment as any).date) : purchase.date;
      const paymentDateYear = paymentOrPurchaseDate.getFullYear();
      const paymentDateMonth = paymentOrPurchaseDate.getMonth();
      const paymentDateDay = paymentOrPurchaseDate.getDate();
      // Create date at noon to avoid timezone conversion issues (same as balanceManagement service expects)
      const paymentDateForBalance = new Date(paymentDateYear, paymentDateMonth, paymentDateDay, 12, 0, 0, 0);
      
      const amount = Number(payment.amount);

      try {
        // Purchase payments can be cash, card, or bank_transfer
        if (payment.type === "cash") {
          await balanceManagementService.updateCashBalance(
            paymentDateForBalance,
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
            paymentDateForBalance,
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
              paymentDateForBalance,
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

    // Recalculate closing balance for the purchase date to include the new payments
    // Use the same purchaseDateStr we used for balance check to ensure consistency
    try {
      const dailyClosingBalanceService = (await import("./dailyClosingBalance.service")).default;
      const { parseLocalYMD } = await import("../utils/date");
      // Use the same purchaseDateStr that was used for balance check to ensure same date
      // This avoids any timezone conversion issues
      const balanceDateObj = parseLocalYMD(purchaseDateStr);
      // Set to noon to match closing balance service expectations
      balanceDateObj.setHours(12, 0, 0, 0);
      console.log("Recalculating closing balance for date:", balanceDateObj, "Date string:", purchaseDateStr);
      await dailyClosingBalanceService.calculateAndStoreClosingBalance(balanceDateObj);
      logger.info(`Recalculated closing balance after purchase creation for ${purchase.id} on date ${purchaseDateStr}`);
    } catch (error: any) {
      logger.error("Error recalculating closing balance after purchase:", error);
      // Don't fail the purchase creation if closing balance recalculation fails
      // The balance transaction is already created, so the balance is correct
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
    // Don't validate or update date for edits - keep original purchase date
    // validateTodayDate(data.date, 'purchase date');

    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: { items: true, supplier: true },
    });

    if (!purchase) {
      throw new Error("Purchase not found");
    }

    // Prevent edits on completed purchases that are older than 7 days
    if (purchase.status === "completed") {
      const purchaseDate = new Date(purchase.date);
      const today = new Date();
      const daysDiff = Math.floor((today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > 7) {
        throw new Error(`Cannot edit completed purchases older than 7 days. This purchase is ${daysDiff} days old.`);
      }
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
      // 1) Revert old stock and validate new quantities
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

          // Check if item is being removed or quantity changed
          const newItem = data.items.find((item: any) => item.productId === oldItem.productId);
          if (!newItem) {
            // Item is being removed - allow removal (stock will be reverted)
            // No validation needed - we're reverting the stock that was added
          } else {
            // Item quantity is being changed - allow both increase and decrease
            const newShopQty = Number((newItem as any).shopQuantity || 0);
            const newWarehouseQty = Number((newItem as any).warehouseQuantity || 0);
            const priceType = (newItem as any).priceType || "single";
            const newShopUnits = priceType === "dozen" ? newShopQty * 12 : newShopQty;
            const newWarehouseUnits = priceType === "dozen" ? newWarehouseQty * 12 : newWarehouseQty;
            
            // Calculate difference
            const shopDiff = newShopUnits - revertShopQty;
            const warehouseDiff = newWarehouseUnits - revertWarehouseQty;
            
            // Allow quantity decreases - no validation needed as we're reverting stock (adding it back)
            
            // Prevent cost/price updates - check if cost has changed
            const oldCost = Number(oldItem.cost || 0);
            const newCost = Number((newItem as any).cost || 0);
            if (oldCost !== newCost) {
              throw new Error(`Cannot update cost for "${product.name}". Cost cannot be changed during edit.`);
            }
          }

          // Revert old stock
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
    
    // Track old payments to detect new ones
    const oldPayments = (purchase.payments as Array<{
      type: string;
      amount: number;
      cardId?: string;
      bankAccountId?: string;
      date?: string | Date;
    }>) || [];
    
    if (data.payments) {
      // Allow payment removal and editing - no restrictions
      updateData.payments = data.payments as any;
      // Recalculate remaining balance
      const totalPaid = data.payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
      const purchaseTotal = data.total !== undefined ? Number(data.total) : Number(purchase.total);
      if (totalPaid > purchaseTotal) {
        throw new Error("Total paid amount cannot exceed total amount");
      }
      updateData.remainingBalance = purchaseTotal - totalPaid;
    }
    // Don't allow date updates - keep original purchase date
    // Date field is not updated when editing purchases
    // if (data.date) updateData.date = new Date(data.date);

    const updatedPurchase = await prisma.purchase.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: getCurrentLocalDateTime(),
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

    // Create balance transactions for new payments added during edit
    if (data.payments) {
      // Find new payments by comparing with old payments
      // New payments are those at indices >= oldPayments.length
      const newPayments: Array<{
        type: "cash" | "card" | "bank_transfer";
        amount: number;
        cardId?: string;
        bankAccountId?: string;
        date?: string | Date;
      }> = [];
      
      if (data.payments.length > oldPayments.length) {
        // There are new payments - get payments beyond the old array length
        newPayments.push(...data.payments.slice(oldPayments.length));
        logger.info(`Found ${newPayments.length} new payment(s) for purchase ${purchase.id} (old: ${oldPayments.length}, new: ${data.payments.length})`);
      }
      
      // Process new payments if any
      if (newPayments.length > 0) {
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
        
          for (const payment of newPayments) {
            const paymentAmount = payment.amount ?? 0;
            if (paymentAmount === null || paymentAmount === undefined || isNaN(Number(paymentAmount)) || paymentAmount <= 0) {
              logger.warn(`Skipping invalid payment amount: ${payment.amount} for purchase ${purchase.id}`);
              continue;
            }

            // Use payment date if available, otherwise use today's date
            const paymentDate = (payment as any).date 
              ? parseLocalISO((payment as any).date) 
              : parseLocalYMDForDB(formatLocalYMD(getTodayInPakistan()));
            const amount = Number(paymentAmount);

            if (payment.type === "cash") {
              await balanceManagementService.updateCashBalance(
                paymentDate,
                amount,
                "expense",
                {
                  description: `Purchase Payment - ${updatedPurchase.supplierName || "N/A"}`,
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
                  description: `Purchase Payment - ${updatedPurchase.supplierName || "N/A"}`,
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
                    description: `Purchase Payment - ${updatedPurchase.supplierName || "N/A"} (Card)`,
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
          logger.error("Error updating balance for purchase payment during edit:", error);
          // Don't throw error - payment was already saved, just log the issue
        }
      }
    }

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

  async cancelPurchase(
    id: string,
    refundData?: {
      refundMethod: "cash" | "bank_transfer";
      bankAccountId?: string;
    },
    userId?: string,
    userName?: string
  ) {
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!purchase) {
      throw new Error("Purchase not found");
    }

    if (purchase.status === "cancelled") {
      throw new Error("Purchase already cancelled");
    }

    // Check if purchase is within 1 week (7 days)
    const purchaseDate = new Date(purchase.date || purchase.createdAt);
    const today = new Date();
    const daysDifference = Math.floor((today.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDifference > 7) {
      throw new Error("Purchase cannot be cancelled. Only purchases within 7 days can be cancelled.");
    }

    // Calculate total paid amount
    const payments = (purchase.payments as Array<{
      type: string;
      amount: number;
      cardId?: string;
      bankAccountId?: string;
    }>) || [];
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // If there are payments, process refund
    if (totalPaid > 0) {
      if (!refundData || !refundData.refundMethod) {
        throw new Error("Refund method is required. Please specify how to refund the payment (cash or bank_transfer).");
      }

      if (refundData.refundMethod === "bank_transfer" && !refundData.bankAccountId) {
        throw new Error("Bank account ID is required for bank transfer refund");
      }

      if (!userId || !userName) {
        throw new Error("User information is required for refund processing");
      }

      // Refund amount back to cash or bank balance
      const balanceManagementService = (await import("./balanceManagement.service")).default;
      const currentDate = new Date();

      try {
        if (refundData.refundMethod === "cash") {
          // Refund to cash balance (add back)
          await balanceManagementService.updateCashBalance(
            currentDate,
            totalPaid,
            "income",
            {
              description: `Purchase Refund - Purchase #${purchase.id}${purchase.supplierName ? ` - ${purchase.supplierName}` : ""}`,
              source: "purchase_refund",
              sourceId: purchase.id,
              userId: userId,
              userName: userName,
            }
          );
          logger.info(`Refunded cash: +${totalPaid} for cancelled purchase ${purchase.id}`);
        } else if (refundData.refundMethod === "bank_transfer" && refundData.bankAccountId) {
          // Refund to bank account balance (add back)
          await balanceManagementService.updateBankBalance(
            refundData.bankAccountId,
            currentDate,
            totalPaid,
            "income",
            {
              description: `Purchase Refund - Purchase #${purchase.id}${purchase.supplierName ? ` - ${purchase.supplierName}` : ""}`,
              source: "purchase_refund",
              sourceId: purchase.id,
              userId: userId,
              userName: userName,
            }
          );
          logger.info(`Refunded bank transfer: +${totalPaid} for cancelled purchase ${purchase.id}`);
        }
      } catch (error: any) {
        logger.error("Error processing refund:", error);
        throw new Error(`Failed to process refund: ${error.message}`);
      }
    }

    // Restore product quantities (deduct what was added during purchase)
    for (const item of purchase.items) {
      const updateData: any = {};
      const product = await prisma.product.findUnique({ where: { id: item.productId } });

      if (product) {
        const shopQtyToDeduct =
          (item as any).shopQuantity ?? (item.toWarehouse === false ? item.quantity : 0);
        const warehouseQtyToDeduct =
          (item as any).warehouseQuantity ?? (item.toWarehouse === false ? 0 : item.quantity);

        if (warehouseQtyToDeduct > 0 && 'warehouseQuantity' in product) {
          updateData.warehouseQuantity = {
            decrement: warehouseQtyToDeduct,
          };
        }
        if (shopQtyToDeduct > 0 && 'shopQuantity' in product) {
          updateData.shopQuantity = {
            decrement: shopQtyToDeduct,
          };
        }
        if (!('shopQuantity' in product) && !('warehouseQuantity' in product)) {
          // Fallback to old schema
          updateData.quantity = {
            decrement: item.quantity,
          };
        }

        const updatedProduct = await prisma.product.update({
          where: { id: item.productId },
          data: updateData,
        });

        // Reset notification if stock recovered
        await productService.checkAndNotifyLowStock(updatedProduct.id);
      }
    }

    // Update purchase status
    const updatedPurchase = await prisma.purchase.update({
      where: { id },
      data: { 
        status: "cancelled",
        updatedAt: getCurrentLocalDateTime(),
      },
    });

    return updatedPurchase;
  }

  async addPaymentToPurchase(
    purchaseId: string,
    payment: {
      type: "cash" | "card" | "bank_transfer";
      amount: number;
      cardId?: string;
      bankAccountId?: string;
      date?: Date;
    },
    userId: string,
    userType?: "user" | "admin"
  ) {
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
    // Always use current date and time for the new payment (avoids timezone/validation issues)
    const paymentDate = formatDateToLocalISO(getCurrentLocalDateTime());

    const paymentAmount = payment.amount || 0;
    const newPayments = [...currentPayments, { ...payment, amount: paymentAmount, date: paymentDate }];
    const totalPaid = newPayments.reduce((sum, p: any) => sum + Number(p.amount || 0), 0);
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
        updatedAt: getCurrentLocalDateTime(),
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
        // Use Pakistan calendar date so BalanceTransaction.date is correct for Reports
        // Use parseLocalYMDForDB to ensure correct date storage in @db.Date column
        const paymentDateForBalance = parseLocalYMDForDB(formatLocalYMD(getTodayInPakistan()));
        const amount = Number(payment.amount);

        // Update balance for cash, bank_transfer, or card payments
        if (payment.type === "cash") {
          await balanceManagementService.updateCashBalance(
            paymentDateForBalance,
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
            paymentDateForBalance,
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
              paymentDateForBalance,
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

      // Recalculate closing balance for the payment date to include the new payment
      try {
        const dailyClosingBalanceService = (await import("./dailyClosingBalance.service")).default;
        // Use payment date if available, otherwise use purchase date
        // Extract date components to avoid timezone issues
        const paymentOrPurchaseDate = (payment as any).date ? parseLocalISO((payment as any).date) : updatedPurchase.date;
        const balanceDateYear = paymentOrPurchaseDate.getFullYear();
        const balanceDateMonth = paymentOrPurchaseDate.getMonth();
        const balanceDateDay = paymentOrPurchaseDate.getDate();
        // Create date at noon to match closing balance service expectations (avoids timezone issues)
        const balanceDateObj = new Date(balanceDateYear, balanceDateMonth, balanceDateDay, 12, 0, 0, 0);
        await dailyClosingBalanceService.calculateAndStoreClosingBalance(balanceDateObj);
        logger.info(`Recalculated closing balance after purchase payment addition for ${purchase.id}`);
      } catch (error: any) {
        logger.error("Error recalculating closing balance after purchase payment:", error);
        // Don't fail the payment addition if closing balance recalculation fails
        // The balance transaction is already created, so the balance is correct
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

