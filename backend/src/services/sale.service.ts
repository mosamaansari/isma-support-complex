 import prisma from "../config/database";
import logger from "../utils/logger";
import whatsappService from "./whatsapp.service";
import productService from "./product.service";
import { validateTodayDate } from "../utils/dateValidation";
import { parseLocalISO, getCurrentLocalDateTime, formatDateToLocalISO, getTodayInPakistan, formatLocalYMD, parseLocalYMDForDB, convertToPakistanTime } from "../utils/date";
import { limitDecimalPlaces } from "../utils/numberHelpers";

const splitSaleQuantities = (item: {
  quantity: number;
  shopQuantity?: number;
  warehouseQuantity?: number;
  fromWarehouse?: boolean;
  productId?: string;
}) => {
  const rawShop = Number(item.shopQuantity ?? 0);
  const rawWarehouse = Number(item.warehouseQuantity ?? 0);
  const splitTotal = rawShop + rawWarehouse;

  let shopQuantity = rawShop;
  let warehouseQuantity = rawWarehouse;

  if (splitTotal === 0) {
    const fallbackQty = Number(item.quantity || 0);
    if (!Number.isFinite(fallbackQty) || fallbackQty <= 0) {
      throw new Error(`Quantity must be greater than 0 for product ${item.productId || ""}`);
    }

    if (item.fromWarehouse) {
      warehouseQuantity = fallbackQty;
      shopQuantity = 0;
    } else {
      shopQuantity = fallbackQty;
      warehouseQuantity = 0;
    }
  }

  const totalQuantity = shopQuantity + warehouseQuantity;
  if (totalQuantity <= 0) {
    throw new Error(`Quantity must be greater than 0 for product ${item.productId || ""}`);
  }

  return { shopQuantity, warehouseQuantity, totalQuantity };
};

class SaleService {
  async getSales(filters: {
    startDate?: string;
    endDate?: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const where: any = {};

    if (filters.startDate && filters.endDate) {
      where.createdAt = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate),
      };
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.OR = [
        { billNumber: { contains: filters.search, mode: "insensitive" } },
        { customerName: { contains: filters.search, mode: "insensitive" } },
        { customerPhone: { contains: filters.search } },
      ];
    }

    const page = filters.page || 1;
    const pageSize = filters.pageSize || 10;
    const skip = (page - 1) * pageSize;

    try {
      const [sales, total] = await Promise.all([
        prisma.sale.findMany({
          where,
          include: {
            items: {
              include: {
                product: true,
              },
            },
            customer: true,
            card: true,
            bankAccount: true,
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: pageSize,
        }),
        prisma.sale.count({ where }),
      ]);

      // Map through sales to convert Decimals to numbers
      const formattedSales = sales.map(sale => ({
        ...sale,
        subtotal: Number(sale.subtotal),
        discount: Number(sale.discount),
        tax: Number(sale.tax),
        total: Number(sale.total),
        remainingBalance: Number(sale.remainingBalance),
        discountType: sale.discountType || "percent",
        taxType: sale.taxType || "percent",
        items: sale.items.map(item => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          customPrice: item.customPrice ? Number(item.customPrice) : null,
          discount: Number(item.discount),
          tax: Number(item.tax),
          total: Number(item.total),
          discountType: item.discountType || "percent",
          taxType: item.taxType || "percent",
        })),
      }));

      return {
        data: formattedSales,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    } catch (error: any) {
      // If card relation doesn't exist, try without it
      if (error.message?.includes('card') || error.message?.includes('Card') || error.code === 'P2025') {
        const sales = await prisma.sale.findMany({
          where,
          include: {
            items: {
              include: {
                product: true,
              },
            },
            customer: true,
          },
          orderBy: { createdAt: "desc" },
        });
        return sales;
      }
      throw error;
    }
  }

  async getSale(id: string) {
    try {
      const sale = await prisma.sale.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          customer: true,
          card: true,
          bankAccount: true,
        },
      });

      if (!sale) {
        throw new Error("Sale not found");
      }

      // Convert Decimals to numbers for easier frontend handling
      return {
        ...sale,
        subtotal: Number(sale.subtotal),
        discount: Number(sale.discount),
        tax: Number(sale.tax),
        total: Number(sale.total),
        remainingBalance: Number(sale.remainingBalance),
        discountType: sale.discountType || "percent",
        taxType: sale.taxType || "percent",
        items: sale.items.map(item => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          customPrice: item.customPrice ? Number(item.customPrice) : null,
          discount: Number(item.discount),
          tax: Number(item.tax),
          total: Number(item.total),
          discountType: item.discountType || "percent",
          taxType: item.taxType || "percent",
        })),
      };
    } catch (error: any) {
      // If card relation doesn't exist, try without it
      if (error.message?.includes('card') || error.message?.includes('Card') || error.code === 'P2025') {
        const sale = await prisma.sale.findUnique({
          where: { id },
          include: {
            items: {
              include: {
                product: true,
              },
            },
            customer: true,
            bankAccount: true,
          },
        });

        if (!sale) {
          throw new Error("Sale not found");
        }

        return sale;
      }
      throw error;
    }
  }

  async getSaleByBillNumber(billNumber: string) {
    try {
      const sale = await prisma.sale.findUnique({
        where: { billNumber },
        include: {
          items: {
            include: {
              product: true,
            },
          },
          customer: true,
          card: true,
          bankAccount: true,
        },
      });

      if (!sale) {
        throw new Error("Sale not found");
      }

      // Convert Decimals to numbers for easier frontend handling
      return {
        ...sale,
        subtotal: Number(sale.subtotal),
        discount: Number(sale.discount),
        tax: Number(sale.tax),
        total: Number(sale.total),
        remainingBalance: Number(sale.remainingBalance),
        discountType: sale.discountType || "percent",
        taxType: sale.taxType || "percent",
        items: sale.items.map(item => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          customPrice: item.customPrice ? Number(item.customPrice) : null,
          discount: Number(item.discount),
          tax: Number(item.tax),
          total: Number(item.total),
          discountType: item.discountType || "percent",
          taxType: item.taxType || "percent",
        })),
      };
    } catch (error: any) {
      // If card relation doesn't exist, try without it
      if (error.message?.includes('card') || error.message?.includes('Card') || error.code === 'P2025') {
        const sale = await prisma.sale.findUnique({
          where: { billNumber },
          include: {
            items: {
              include: {
                product: true,
              },
            },
            customer: true,
          },
        });

        if (!sale) {
          throw new Error("Sale not found");
        }

        return sale;
      }
      throw error;
    }
  }

  async createSale(
    data: {
      items: Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
        customPrice?: number;
        priceType?: "single" | "dozen";
        priceSingle?: number;
        priceDozen?: number;
        discount?: number;
        discountType?: "percent" | "value";
        fromWarehouse?: boolean;
      }>;
      customerName?: string;
      customerPhone?: string;
      customerCity?: string;
      customerId?: string;
      paymentType?: string;
      payments?: Array<{
        type: "cash" | "card" | "credit" | "bank_transfer";
        amount: number;
        cardId?: string;
        bankAccountId?: string;
      }>;
      cardId?: string;
      bankAccountId?: string;
      discount?: number;
      discountType?: "percent" | "value";
      tax?: number;
      taxType?: "percent" | "value";
      date?: string;
    },
    userId: string,
    userType?: "user" | "admin"
  ) {
    // Validate that date is today (if provided)
    validateTodayDate(data.date, 'sale date');
    console.log(data)
    
    // Parse sale date properly to avoid timezone issues
    // Use parseLocalISO to avoid timezone conversion issues
    const saleDate = data.date ? parseLocalISO(data.date) : new Date();
    const saleDateStr = formatLocalYMD(saleDate);
    console.log("saleDateStr", saleDateStr, "original date:", data.date);
    
    // Generate bill number based on target date to stay consistent with client
    const targetDateForBill = saleDate;
    const yearOutput = targetDateForBill.getFullYear();
    const monthOutput = String(targetDateForBill.getMonth() + 1).padStart(2, '0');
    const dayOutput = String(targetDateForBill.getDate()).padStart(2, '0');
    const dateStr = `${yearOutput}${monthOutput}${dayOutput}`;

    const count = await prisma.sale.count({
      where: {
        billNumber: {
          startsWith: `BILL-${dateStr}`,
        },
      },
    });
    const billNumber = `BILL-${dateStr}-${String(count + 1).padStart(4, "0")}`;

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

    // Calculate totals
    let subtotal = 0;
    const saleItems = [];

    for (const item of data.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }

      // Quantity normalization:
      // Support both payload styles:
      // - Preferred (new frontend): quantities already in units (multiples of 12 for dozen sales)
      // - Legacy/alternate: priceType=dozen and quantities represent dozens (so multiply by 12)
      const rawShopQty = Number((item as any).shopQuantity ?? 0);
      const rawWarehouseQty = Number((item as any).warehouseQuantity ?? 0);
      const rawQty = Number(item.quantity || 0);

      const shouldTreatAsDozenQty =
        item.priceType === "dozen" &&
        (
          (rawShopQty > 0 && rawShopQty % 12 !== 0) ||
          (rawWarehouseQty > 0 && rawWarehouseQty % 12 !== 0) ||
          (rawQty > 0 && rawQty % 12 !== 0)
        );

      const qtyMultiplier = shouldTreatAsDozenQty ? 12 : 1;

      const itemForSplit: any = {
        ...item,
        quantity: rawQty * qtyMultiplier,
        shopQuantity: rawShopQty * qtyMultiplier,
        warehouseQuantity: rawWarehouseQty * qtyMultiplier,
      };

      const { shopQuantity, warehouseQuantity, totalQuantity } = splitSaleQuantities(itemForSplit);

      // Normalize price fields:
      // - customPrice remains per-unit (single) price used in calculations
      // - store both single/dozen prices for reporting and UI
      const priceType: "single" | "dozen" = (item.priceType as any) || "single";
      const baseUnitPrice = product.salePrice ? Number(product.salePrice) : 0;
      const effectiveUnitPrice = item.customPrice ?? baseUnitPrice;

      let priceSingle =
        item.priceSingle !== undefined && item.priceSingle !== null
          ? Number(item.priceSingle)
          : Number(effectiveUnitPrice);
      let priceDozen =
        item.priceDozen !== undefined && item.priceDozen !== null
          ? Number(item.priceDozen)
          : Number(priceSingle * 12);

      if (priceType === "dozen") {
        if (item.priceDozen !== undefined && item.priceDozen !== null) {
          priceDozen = Number(item.priceDozen);
          if (!(item.priceSingle !== undefined && item.priceSingle !== null)) {
            priceSingle = priceDozen / 12;
          }
        } else {
          priceDozen = priceSingle * 12;
        }
      } else {
        priceDozen = priceDozen || priceSingle * 12;
      }

      // Don't round price early - round only the final result to avoid precision loss
      const effectivePrice = item.customPrice ?? priceSingle ?? 0;
      // Round unitPrice for storage consistency, but use unrounded effectivePrice for calculations
      const unitPrice = product.salePrice ? limitDecimalPlaces(Number(product.salePrice)) : 0;
      // Multiply first, then round to avoid precision loss (e.g., 0.0833... * 24 = 2.0, not 0.08 * 24 = 1.92)
      const itemSubtotal = limitDecimalPlaces(effectivePrice * totalQuantity);

      // Calculate discount based on type
      let itemDiscount = 0;
      if (item.discount && item.discount > 0) {
        if (item.discountType === "value") {
          itemDiscount = limitDecimalPlaces(item.discount);
        } else {
          itemDiscount = limitDecimalPlaces((itemSubtotal * item.discount) / 100);
        }
      }

      const itemTotal = limitDecimalPlaces(itemSubtotal - itemDiscount);

      subtotal = limitDecimalPlaces(subtotal + itemTotal);

      const shopAvailable = product.shopQuantity ?? (product as any).quantity ?? 0;
      const warehouseAvailable = product.warehouseQuantity ?? 0;

      if (shopQuantity > shopAvailable) {
        throw new Error(
          `Insufficient shop stock for ${product.name}. Available: ${shopAvailable}`
        );
      }
      if (warehouseQuantity > warehouseAvailable) {
        throw new Error(
          `Insufficient warehouse stock for ${product.name}. Available: ${warehouseAvailable}`
        );
      }

      saleItems.push({
        productId: product.id,
        productName: product.name,
        quantity: totalQuantity,
        shopQuantity,
        warehouseQuantity,
        unitPrice: unitPrice,
        customPrice: item.customPrice || null,
        priceType,
        priceSingle,
        priceDozen,
        discount: item.discount || 0,
        discountType: item.discountType || "percent",
        tax: 0,
        taxType: "percent",
        total: itemTotal,
        fromWarehouse: warehouseQuantity > 0 && shopQuantity === 0,
      });
    }

    // Calculate global discount based on type
    let discountAmount = 0;
    if (data.discount && data.discount > 0) {
      if (data.discountType === "value") {
        discountAmount = limitDecimalPlaces(data.discount);
      } else {
        discountAmount = limitDecimalPlaces((subtotal * data.discount) / 100);
      }
    }

    // Calculate global tax based on type
    let taxAmount = 0;
    if (data.tax && data.tax > 0) {
      if (data.taxType === "value") {
        taxAmount = limitDecimalPlaces(data.tax);
      } else {
        const afterDiscount = limitDecimalPlaces(subtotal - discountAmount);
        taxAmount = limitDecimalPlaces((afterDiscount * data.tax) / 100);
      }
    }

    const total = limitDecimalPlaces(subtotal - discountAmount + taxAmount);

    // Get or create customer (optional - use default if not provided)
    const customerName = data.customerName || "Walk-in Customer";
    const customerPhone = data.customerPhone && data.customerPhone.trim() !== "" && data.customerPhone !== "0000000000"
      ? data.customerPhone.trim()
      : null;
    const customerCity = data.customerCity || null;

    let customer = null;
    let customerId = null;

    // Only create/find customer if phone number is provided and valid (not empty or "0000000000")
    if (customerPhone && customerPhone.trim() !== "" && customerPhone !== "0000000000") {
      customer = await prisma.customer.findFirst({
        where: { phone: customerPhone },
      });

      if (!customer) {
        customer = await prisma.customer.create({
          data: {
            name: customerName,
            phone: customerPhone,
            city: customerCity,
          },
        });
      } else if (customerCity && customer.city !== customerCity) {
        // Update city if provided and different
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: { city: customerCity },
        });
      }

      customerId = customer.id;
    }

    // Handle payments - support both old single payment and new multiple payments
    let payments: Array<{
      type: "cash" | "card" | "credit" | "bank_transfer";
      amount: number;
      cardId?: string;
      bankAccountId?: string;
      date?: string | Date;
    }> = [];
    let remainingBalance = total;

    // Check if payments array exists and has valid payments
    // IMPORTANT: If payments array exists (even if empty), use new format - don't create default payment
    if (data.payments !== undefined && Array.isArray(data.payments)) {
      // New multiple payments format - filter out payments with empty/undefined/null/0 amount
      const validPayments = data.payments.filter((payment: any) => {
        const amount = payment.amount ?? 0;
        return amount !== null && amount !== undefined && !isNaN(Number(amount)) && Number(amount) > 0;
      });
      
      if (validPayments.length > 0) {
        // We have valid payments - process them
        // Store dates as ISO strings without UTC conversion (no "Z" suffix)
        const saleDate = data.date || formatDateToLocalISO(getCurrentLocalDateTime());
        payments = validPayments.map((payment: any) => ({
          ...payment,
          // Use formatDateToLocalISO to ensure date is stored as string without "Z" suffix
          // This matches how addPaymentToSale stores dates
          date: data.date ? (typeof data.date === 'string' ? data.date : formatDateToLocalISO(parseLocalISO(data.date))) : formatDateToLocalISO(getCurrentLocalDateTime()),
        }));
        const totalPaid = payments.reduce((sum, payment) => sum + (payment.amount || 0), 0);
        remainingBalance = total - totalPaid;

        if (totalPaid > total) {
          throw new Error("Total payment amount cannot exceed sale total");
        }
      } else {
        // Payments array was provided (even if empty []) but all were empty/0 - no payments made
        // Don't create default payment - user explicitly didn't provide any payment
        payments = [];
        remainingBalance = total;
      }
    } else if (data.paymentType && data.payments === undefined) {
      // Old single payment format (backward compatibility) - ONLY if:
      // 1. paymentType is explicitly provided
      // 2. payments field doesn't exist at all (undefined, not empty array)
      // This handles old API clients that don't send payments array
      const paymentType = (data.paymentType || "cash") as "cash" | "bank_transfer";
      const paymentAmount = total;
      remainingBalance = 0;
      // Store date as ISO string without UTC conversion (no "Z" suffix)
      const saleDate = data.date || formatDateToLocalISO(getCurrentLocalDateTime());

      payments = [{
        type: paymentType,
        amount: paymentAmount,
        bankAccountId: data.bankAccountId || undefined,
        // Use formatDateToLocalISO to ensure date is stored as string without "Z" suffix
        // This matches how addPaymentToSale stores dates
        date: data.date ? (typeof data.date === 'string' ? data.date : formatDateToLocalISO(parseLocalISO(data.date))) : formatDateToLocalISO(getCurrentLocalDateTime()),
      }];
    } else {
      // No payments array provided (or payments is null) - user hasn't made any payment
      payments = [];
      remainingBalance = total;
    }

    // Determine status based on remaining balance
    const saleStatus = remainingBalance > 0 ? "pending" : "completed";

    // Create sale with items
    const sale = await prisma.sale.create({
      data: {
        billNumber,
        subtotal,
        discount: data.discount || 0,
        discountType: data.discountType || "percent",
        tax: data.tax || 0,
        taxType: data.taxType || "percent",
        total,
        paymentType: payments[0]?.type || ("cash" as any),
        payments: payments as any,
        remainingBalance: remainingBalance,
        status: saleStatus as any,
        bankAccountId: payments.find(p => p.type === "bank_transfer")?.bankAccountId || data.bankAccountId || null,
        customerId: customerId || null,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        customerCity: customerCity || null,
        date: data.date ? parseLocalISO(data.date) : getCurrentLocalDateTime(),
        createdAt: getCurrentLocalDateTime(),
        updatedAt: getCurrentLocalDateTime(),
        userId: user.id,
        userName: user.name,
        createdBy: user.id,
        createdByType: userTypeToUse,
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
        card: true,
        bankAccount: true,
      },
    });

    // Update customer due amount if there's remaining balance and customer exists
    if (remainingBalance > 0 && customerId) {
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          dueAmount: {
            increment: remainingBalance,
          },
        },
      });
    }

    // Update product quantities (shop or warehouse)
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      const saleItem = saleItems[i];
      const updateData: any = {};

      // Get product again to check schema
      const productForUpdate = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (productForUpdate) {
        const shopQtyToDecrement =
          (saleItem as any).shopQuantity ?? (saleItem.fromWarehouse ? 0 : saleItem.quantity);
        const warehouseQtyToDecrement =
          (saleItem as any).warehouseQuantity ?? (saleItem.fromWarehouse ? saleItem.quantity : 0);

        if ('warehouseQuantity' in productForUpdate && warehouseQtyToDecrement > 0) {
          updateData.warehouseQuantity = {
            decrement: warehouseQtyToDecrement,
          };
        }

        if ('shopQuantity' in productForUpdate && shopQtyToDecrement > 0) {
          updateData.shopQuantity = {
            decrement: shopQtyToDecrement,
          };
        }

        // Fallback to old schema if needed
        if (!('shopQuantity' in productForUpdate) && !('warehouseQuantity' in productForUpdate)) {
          updateData.quantity = {
            decrement: saleItem.quantity,
          };
        }

        const updatedProduct = await prisma.product.update({
          where: { id: item.productId },
          data: updateData,
        });

        // Check low stock notifications (send/reset)
        await productService.checkAndNotifyLowStock(updatedProduct.id);
      }
    }

    // Update balances atomically for payments using balance management service
    try {
      const balanceManagementService = (await import("./balanceManagement.service")).default;
      const payments = (sale.payments as Array<{
        type: string;
        amount: number;
        bankAccountId?: string;
        cardId?: string;
      }>) || [];

      for (const payment of payments) {
        // Skip invalid payments (allow 0, but skip null/undefined/NaN)
        const paymentAmount = payment.amount ?? 0;
        if (paymentAmount === null || paymentAmount === undefined || isNaN(Number(paymentAmount)) || paymentAmount < 0) {
          logger.warn(`Skipping invalid payment amount: ${payment.amount} for sale ${sale.id}`);
          continue;
        }
        // Use sale date for balance updates (not payment date)
        // Extract date components from sale date to avoid timezone issues
        const saleDateYear = sale.date.getFullYear();
        const saleDateMonth = sale.date.getMonth();
        const saleDateDay = sale.date.getDate();
        // Create date at noon to avoid timezone conversion issues (same as balanceManagement service expects)
        const saleDateForBalance = new Date(saleDateYear, saleDateMonth, saleDateDay, 12, 0, 0, 0);
        
        // Handle cash, bank_transfer, and card payments
        if (payment.type === "cash") {
          await balanceManagementService.updateCashBalance(
            saleDateForBalance,
            Number(paymentAmount),
            "income",
            {
              description: `Sale Payment - Bill #${sale.billNumber}${sale.customerName ? ` - ${sale.customerName}` : ""}`,
              source: "sale_payment",
              sourceId: sale.id,
              userId: user.id,
              userName: user.name,
            }
          );
          logger.info(`Updated cash balance: +${paymentAmount} for sale ${sale.billNumber}`);
        } else if (payment.type === "bank_transfer") {
          const bankAccountId = payment.bankAccountId || sale.bankAccountId;
          if (bankAccountId) {
            await balanceManagementService.updateBankBalance(
              bankAccountId,
              saleDateForBalance,
              Number(paymentAmount),
              "income",
              {
                description: `Sale Payment - Bill #${sale.billNumber}${sale.customerName ? ` - ${sale.customerName}` : ""}`,
                source: "sale_payment",
                sourceId: sale.id,
                userId: user.id,
                userName: user.name,
              }
            );
            logger.info(`Updated bank balance: +${paymentAmount} for sale ${sale.billNumber}, bank: ${bankAccountId}`);
          }
        } else if (payment.type === "card") {
          const cardId = payment.cardId || sale.cardId;
          if (cardId) {
            await balanceManagementService.updateCardBalance(
              cardId,
              saleDateForBalance,
              Number(paymentAmount),
              "income",
              {
                description: `Sale Payment - Bill #${sale.billNumber}${sale.customerName ? ` - ${sale.customerName}` : ""} (Card)`,
                source: "sale_payment",
                sourceId: sale.id,
                userId: user.id,
                userName: user.name,
              }
            );
            logger.info(`Updated card balance: +${paymentAmount} for sale ${sale.billNumber}, card: ${cardId}`);
          } else {
            logger.warn(`Skipping card payment without cardId for sale ${sale.billNumber}`);
          }
        }
        // Note: credit payments don't create balance transactions (they're future payments)
      }
    } catch (error: any) {
      logger.error("Error updating balance for sale:", error);
      // Don't fail the sale creation if balance update fails, but log it
      throw error; // Re-throw to ensure transaction is rolled back
    }

    // Note: Closing balance is now updated directly in balanceManagementService.updateCashBalance/updateBankBalance/updateCardBalance
    // No need to recalculate here - the direct add/subtract method handles it

    // Send WhatsApp notification if customer phone number exists and payment is completed
    if (sale.customerPhone && sale.status === "completed" && sale.customerPhone !== "0000000000" && sale.customerPhone.trim() !== "") {
      try {
        const payments = (sale.payments as Array<{ type: string; amount: number }>) || [];
        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const remaining = Number(sale.remainingBalance || 0);

        await whatsappService.sendBillNotificationWithImage(
          sale.customerPhone,
          sale,
          undefined
        );
        logger.info(`WhatsApp notification sent for new sale ${sale.billNumber}`);
      } catch (whatsappError: any) {
        // Don't fail the sale creation if WhatsApp fails
        logger.error(`Failed to send WhatsApp notification: ${whatsappError.message}`);
      }
    }

    return sale;
  }

  async cancelSale(
    id: string,
    refundData?: {
      refundMethod: "cash" | "bank_transfer";
      bankAccountId?: string;
    },
    userId?: string,
    userName?: string
  ) {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!sale) {
      throw new Error("Sale not found");
    }

    if (sale.status === "cancelled") {
      throw new Error("Sale already cancelled");
    }

    // Check if sale is within 1 week (7 days) from createdAt
    const saleCreatedAt = new Date(sale.createdAt);
    const today = new Date();
    const daysDifference = Math.floor((today.getTime() - saleCreatedAt.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDifference > 7) {
      throw new Error("Sale cannot be cancelled. Only sales within 7 days of creation can be cancelled.");
    }

    // Calculate total paid amount
    const payments = (sale.payments as Array<{
      type: string;
      amount: number;
      cardId?: string;
      bankAccountId?: string;
    }>) || [];
    const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // If there are payments, process refund based on refundData
    if (totalPaid > 0) {
      if (!userId || !userName) {
        throw new Error("User information is required for refund processing");
      }

      const balanceManagementService = (await import("./balanceManagement.service")).default;
      // Use Pakistan calendar date so refund transaction appears in Reports on the correct date
      const refundDateForBalance = parseLocalYMDForDB(formatLocalYMD(getTodayInPakistan()));

      // Determine refund method: use refundData if provided, otherwise refund to original sources
      const refundMethod = refundData?.refundMethod || null;
      const refundBankAccountId = refundData?.bankAccountId || null;

      // If bank transfer refund is requested, check balance first
      if (refundMethod === "bank_transfer" && refundBankAccountId) {
        const currentBalance = await balanceManagementService.getCurrentBankBalance(refundBankAccountId, refundDateForBalance);
        if (currentBalance < totalPaid) {
          throw new Error(`Insufficient bank balance. Available: Rs. ${currentBalance.toFixed(2)}, Required: Rs. ${totalPaid.toFixed(2)}`);
        }
      }

      try {
        if (refundMethod === "cash") {
          // Refund entire amount to cash
          await balanceManagementService.updateCashBalance(
            refundDateForBalance,
            totalPaid,
            "expense",
            {
              description: `Sale Refund - Bill #${sale.billNumber}${sale.customerName ? ` - ${sale.customerName}` : ""}`,
              source: "sale_refund",
              sourceId: sale.id,
              userId: userId,
              userName: userName,
            }
          );
          logger.info(`Refunded cash: -${totalPaid} for cancelled sale ${sale.billNumber}`);
        } else if (refundMethod === "bank_transfer" && refundBankAccountId) {
          // Refund entire amount to specified bank account
          await balanceManagementService.updateBankBalance(
            refundBankAccountId,
            refundDateForBalance,
            totalPaid,
            "expense",
            {
              description: `Sale Refund - Bill #${sale.billNumber}${sale.customerName ? ` - ${sale.customerName}` : ""}`,
              source: "sale_refund",
              sourceId: sale.id,
              userId: userId,
              userName: userName,
            }
          );
          logger.info(`Refunded bank transfer: -${totalPaid} for cancelled sale ${sale.billNumber}, bank: ${refundBankAccountId}`);
        } else {
          // Default: Process each payment refund to its original source
          for (const payment of payments) {
            const paymentAmount = payment.amount || 0;
            if (paymentAmount <= 0) continue;

            if (payment.type === "cash") {
              // Refund to cash balance (deduct as expense)
              await balanceManagementService.updateCashBalance(
                refundDateForBalance,
                paymentAmount,
                "expense",
                {
                  description: `Sale Refund - Bill #${sale.billNumber}${sale.customerName ? ` - ${sale.customerName}` : ""}`,
                  source: "sale_refund",
                  sourceId: sale.id,
                  userId: userId,
                  userName: userName,
                }
              );
              logger.info(`Refunded cash: -${paymentAmount} for cancelled sale ${sale.billNumber}`);
            } else if (payment.type === "card" && payment.cardId) {
              // Refund to card balance (deduct as expense)
              await balanceManagementService.updateCardBalance(
                payment.cardId,
                refundDateForBalance,
                paymentAmount,
                "expense",
                {
                  description: `Sale Refund - Bill #${sale.billNumber}${sale.customerName ? ` - ${sale.customerName}` : ""}`,
                  source: "sale_refund",
                  sourceId: sale.id,
                  userId: userId,
                  userName: userName,
                }
              );
              logger.info(`Refunded card: -${paymentAmount} for cancelled sale ${sale.billNumber}, card: ${payment.cardId}`);
            } else if (payment.type === "bank_transfer" && payment.bankAccountId) {
              // Refund to bank account balance (deduct as expense)
              await balanceManagementService.updateBankBalance(
                payment.bankAccountId,
                refundDateForBalance,
                paymentAmount,
                "expense",
                {
                  description: `Sale Refund - Bill #${sale.billNumber}${sale.customerName ? ` - ${sale.customerName}` : ""}`,
                  source: "sale_refund",
                  sourceId: sale.id,
                  userId: userId,
                  userName: userName,
                }
              );
              logger.info(`Refunded bank transfer: -${paymentAmount} for cancelled sale ${sale.billNumber}, bank: ${payment.bankAccountId}`);
            } else if (payment.type === "credit") {
              // For credit payments, update customer due amount
              if (sale.customerId) {
                const customer = await prisma.customer.findUnique({ where: { id: sale.customerId } });
                if (customer) {
                  const oldDue = Number(customer.dueAmount || 0);
                  const newDue = oldDue + paymentAmount;
                  await prisma.customer.update({
                    where: { id: sale.customerId },
                    data: { dueAmount: newDue },
                  });
                  logger.info(`Restored credit: +${paymentAmount} to customer due for cancelled sale ${sale.billNumber}`);
                }
              }
            }
          }
        }
      } catch (error: any) {
        logger.error("Error processing refund:", error);
        throw new Error(`Failed to process refund: ${error.message}`);
      }
    }

    // Note: Closing balance is now updated directly in balanceManagementService.updateCashBalance/updateBankBalance/updateCardBalance
    // No need to recalculate here - the direct add/subtract method handles it (refunds subtract from balance)

    // Restore product quantities (shop or warehouse)
    for (const item of sale.items) {
      const updateData: any = {};
      const product = await prisma.product.findUnique({ where: { id: item.productId } });

      if (product) {
        const shopQtyToRestore =
          (item as any).shopQuantity ?? (item.fromWarehouse ? 0 : item.quantity);
        const warehouseQtyToRestore =
          (item as any).warehouseQuantity ?? (item.fromWarehouse ? item.quantity : 0);

        if (warehouseQtyToRestore > 0 && 'warehouseQuantity' in product) {
          updateData.warehouseQuantity = {
            increment: warehouseQtyToRestore,
          };
        }
        if (shopQtyToRestore > 0 && 'shopQuantity' in product) {
          updateData.shopQuantity = {
            increment: shopQtyToRestore,
          };
        }
        if (!('shopQuantity' in product) && !('warehouseQuantity' in product)) {
          // Fallback to old schema
          updateData.quantity = {
            increment: item.quantity,
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

    // Update sale status
    const updatedSale = await prisma.sale.update({
      where: { id },
      data: { 
        status: "cancelled",
        updatedAt: getCurrentLocalDateTime(),
      },
    });

    return updatedSale;
  }

  async addPaymentToSale(
    saleId: string,
    payment: {
      type: "cash" | "card" | "credit" | "bank_transfer";
      amount: number;
      cardId?: string;
      bankAccountId?: string;
      date?: string;
    },
    userId?: string,
    userType?: "user" | "admin"
  ) {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { customer: true },
    });

    if (!sale) {
      throw new Error("Sale not found");
    }

    if (sale.status === "cancelled") {
      throw new Error("Cannot add payment to cancelled sale");
    }

    const currentPayments = (sale.payments as Array<{
      type: string;
      amount: number;
      cardId?: string;
      bankAccountId?: string;
      date?: string | Date;
    }>) || [];

    const totalPaid = currentPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const currentRemaining = Number(sale.remainingBalance);
    const paymentAmount = payment.amount || 0;

    if (paymentAmount > currentRemaining) {
      throw new Error("Payment amount exceeds remaining balance");
    }
    // Guard against total paid surpassing total
    if (totalPaid + paymentAmount > Number(sale.total)) {
      throw new Error("Total payment amount cannot exceed sale total");
    }

    // Convert payment date to Pakistani time if provided, otherwise use current Pakistani time
    let paymentDate: string;
    if (payment.date) {
      // Convert provided date to Pakistani timezone
      const pakistanTime = convertToPakistanTime(payment.date);
      paymentDate = formatDateToLocalISO(pakistanTime);
    } else {
      // Use current date and time in Pakistani timezone
      paymentDate = formatDateToLocalISO(getCurrentLocalDateTime());
    }

    const paymentWithDate = {
      ...payment,
      date: paymentDate
    };
    console.log("paymentWithDate", paymentWithDate)
    const newPayments = [...currentPayments, paymentWithDate];
    const newTotalPaid = totalPaid + paymentAmount;
    const newRemainingBalance = Number(sale.total) - newTotalPaid;

    // Update status: if remaining balance is 0 or less, mark as completed
    const newStatus = newRemainingBalance <= 0 ? "completed" : "pending";

    const updatedSale = await prisma.sale.update({
      where: { id: saleId },
      data: {
        payments: newPayments as any,
        remainingBalance: newRemainingBalance,
        status: newStatus as any,
        updatedAt: getCurrentLocalDateTime(),
        // Update paymentType to the latest payment type for backward compatibility
        paymentType: payment.type as any,
        bankAccountId: payment.type === "bank_transfer" ? payment.bankAccountId || sale.bankAccountId : sale.bankAccountId,
        updatedBy: userId || null,
        updatedByType: userType || null,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
        card: true,
        bankAccount: true,
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

      // Skip invalid payments (allow 0, but skip null/undefined/NaN)
      const paymentAmount = payment.amount ?? 0;
      if (paymentAmount === null || paymentAmount === undefined || isNaN(Number(paymentAmount)) || paymentAmount < 0) {
        logger.warn(`Skipping invalid payment amount: ${payment.amount} for sale ${sale.id}`);
      } else {
        // Use payment date (today in Pakistan) for balance updates so the transaction
        // appears in Reports "All Transactions" on the day the payment was actually added
        // Use parseLocalYMDForDB to ensure correct date storage in @db.Date column
        const paymentDateForBalance = parseLocalYMDForDB(formatLocalYMD(getTodayInPakistan()));
        const amount = Number(paymentAmount);

        // Update balance only for cash, bank_transfer, or card payments (not credit)
        if (payment.type === "cash") {
          await balanceManagementService.updateCashBalance(
            paymentDateForBalance,
            amount,
            "income",
            {
              description: `Sale Payment - Bill #${sale.billNumber}${sale.customerName ? ` - ${sale.customerName}` : ""}`,
              source: "sale_payment",
              sourceId: sale.id,
              userId: userId || "system",
              userName: userName,
            }
          );
          logger.info(`Updated cash balance: +${amount} for sale payment ${sale.billNumber}`);
        } else if (payment.type === "bank_transfer" && (payment.bankAccountId || sale.bankAccountId)) {
          const bankAccountId = payment.bankAccountId || sale.bankAccountId;
          if (bankAccountId) {
            await balanceManagementService.updateBankBalance(
              bankAccountId,
              paymentDateForBalance,
              amount,
              "income",
              {
                description: `Sale Payment - Bill #${sale.billNumber}${sale.customerName ? ` - ${sale.customerName}` : ""}`,
                source: "sale_payment",
                sourceId: sale.id,
                userId: userId || "system",
                userName: userName,
              }
            );
            logger.info(`Updated bank balance: +${amount} for sale payment ${sale.billNumber}, bank: ${bankAccountId}`);
          }
        } else if (payment.type === "card" && (payment.cardId || sale.cardId)) {
          const cardId = payment.cardId || sale.cardId;
          if (cardId) {
            await balanceManagementService.updateCardBalance(
              cardId,
              paymentDateForBalance,
              amount,
              "income",
              {
                description: `Sale Payment - Bill #${sale.billNumber}${sale.customerName ? ` - ${sale.customerName}` : ""} (Card)`,
                source: "sale_payment",
                sourceId: sale.id,
                userId: userId || "system",
                userName: userName,
              }
            );
            logger.info(`Updated card balance: +${amount} for sale payment ${sale.billNumber}, card: ${cardId}`);
          }
        }
      }
    } catch (error: any) {
      logger.error("Error updating balance for sale payment:", error);
      // Re-throw to ensure the error is propagated
      throw new Error(`Failed to update balance for sale payment: ${error.message}`);
    }

    // Note: Closing balance is now updated directly in balanceManagementService.updateCashBalance/updateBankBalance/updateCardBalance
    // No need to recalculate here - the direct add/subtract method handles it

    // Update customer due amount
    if (sale.customerId) {
      const oldDue = Number(sale.customer?.dueAmount || 0);
      const newDue = oldDue - (payment.amount || 0);

      await prisma.customer.update({
        where: { id: sale.customerId },
        data: {
          dueAmount: newDue > 0 ? newDue : 0,
        },
      });
    }

    // Send WhatsApp notification if customer phone number exists
    if (updatedSale.customerPhone && updatedSale.customerPhone !== "0000000000" && updatedSale.customerPhone.trim() !== "") {
      try {
        const payments = (updatedSale.payments as Array<{ type: string; amount: number; date?: string }>) || [];
        const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
        const remaining = Number(updatedSale.remainingBalance || 0);

        await whatsappService.sendBillNotificationWithImage(
          updatedSale.customerPhone,
          updatedSale,
          undefined // Image buffer can be added later if needed
        );
        logger.info(`WhatsApp notification sent for payment on sale ${updatedSale.billNumber}`);
      } catch (whatsappError: any) {
        // Don't fail the payment if WhatsApp fails
        logger.error(`Failed to send WhatsApp notification: ${whatsappError.message}`);
      }
    }

    return updatedSale;
  }
}

export default new SaleService();

