import prisma from "../config/database";
import logger from "../utils/logger";
import whatsappService from "./whatsapp.service";
import productService from "./product.service";

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
      console.log(sale)
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

      const { shopQuantity, warehouseQuantity, totalQuantity } = splitSaleQuantities(item);

      const effectivePrice = item.customPrice || (product.salePrice ? Number(product.salePrice) : 0);
      const unitPrice = product.salePrice ? Number(product.salePrice) : 0;
      const itemSubtotal = effectivePrice * totalQuantity;

      // Calculate discount based on type
      let itemDiscount = 0;
      if (item.discount && item.discount > 0) {
        if (item.discountType === "value") {
          itemDiscount = item.discount;
        } else {
          itemDiscount = (itemSubtotal * item.discount) / 100;
        }
      }

      const itemTotal = itemSubtotal - itemDiscount;

      subtotal += itemTotal;

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
        discountAmount = data.discount;
      } else {
        discountAmount = (subtotal * data.discount) / 100;
      }
    }

    // Calculate global tax based on type
    let taxAmount = 0;
    if (data.tax && data.tax > 0) {
      if (data.taxType === "value") {
        taxAmount = data.tax;
      } else {
        const afterDiscount = subtotal - discountAmount;
        taxAmount = (afterDiscount * data.tax) / 100;
      }
    }

    const total = subtotal - discountAmount + taxAmount;

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
      date?: string;
    }> = [];
    let remainingBalance = total;

    if (data.payments && data.payments.length > 0) {
      // New multiple payments format - add current date and time to all payments
      const currentDateTime = new Date().toISOString();
      payments = data.payments.map((payment: any) => ({
        ...payment,
        date: currentDateTime // Always use current date and time
      }));
      const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
      remainingBalance = total - totalPaid;

      if (totalPaid > total) {
        throw new Error("Total payment amount cannot exceed sale total");
      }
    } else {
      // Old single payment format (backward compatibility)
      const paymentType = (data.paymentType || "cash") as "cash" | "bank_transfer";
      const paymentAmount = total;
      remainingBalance = 0;

      payments = [{
        type: paymentType,
        amount: paymentAmount,
        bankAccountId: data.bankAccountId || undefined,
        date: new Date().toISOString(), // Always use current date and time
      }];
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
        date: data.date ? new Date(data.date) : new Date(),
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
        // Skip invalid payments
        if (!payment.amount || payment.amount <= 0 || isNaN(Number(payment.amount))) {
          logger.warn(`Skipping invalid payment amount: ${payment.amount} for sale ${sale.id}`);
          continue;
        }

        // Handle cash, bank_transfer, and card payments (card maps to bank_transfer for balance tracking)
        if (payment.type === "cash") {
          await balanceManagementService.updateCashBalance(
            sale.date,
            Number(payment.amount),
            "income",
            {
              description: `Sale - Bill #${sale.billNumber}${sale.customerName ? ` - ${sale.customerName}` : ""}`,
              source: "sale",
              sourceId: sale.id,
              userId: user.id,
              userName: user.name,
            }
          );
          logger.info(`Updated cash balance: +${payment.amount} for sale ${sale.billNumber}`);
        } else if (payment.type === "bank_transfer" || payment.type === "card") {
          // Card payments are treated as bank transfers for balance tracking
          const bankAccountId = payment.bankAccountId || sale.bankAccountId || payment.cardId;
          if (bankAccountId) {
            await balanceManagementService.updateBankBalance(
              bankAccountId,
              sale.date,
              Number(payment.amount),
              "income",
              {
                description: `Sale - Bill #${sale.billNumber}${sale.customerName ? ` - ${sale.customerName}` : ""}${payment.type === "card" ? " (Card)" : ""}`,
                source: "sale",
                sourceId: sale.id,
                userId: user.id,
                userName: user.name,
              }
            );
            logger.info(`Updated bank balance: +${payment.amount} for sale ${sale.billNumber}, bank: ${bankAccountId}`);
          } else {
            logger.warn(`Skipping ${payment.type} payment without bankAccountId for sale ${sale.billNumber}`);
          }
        }
        // Note: credit payments don't create balance transactions (they're future payments)
      }
    } catch (error: any) {
      logger.error("Error updating balance for sale:", error);
      // Don't fail the sale creation if balance update fails, but log it
      throw error; // Re-throw to ensure transaction is rolled back
    }

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

  async cancelSale(id: string) {
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
      data: { status: "cancelled" },
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
      date?: string;
    }>) || [];

    const totalPaid = currentPayments.reduce((sum, p) => sum + p.amount, 0);
    const currentRemaining = Number(sale.remainingBalance);

    if (payment.amount > currentRemaining) {
      throw new Error("Payment amount exceeds remaining balance");
    }
    // Guard against total paid surpassing total
    if (totalPaid + payment.amount > Number(sale.total)) {
      throw new Error("Total payment amount cannot exceed sale total");
    }

    // Add current date and time to payment (always use current timestamp)
    const paymentWithDate = {
      ...payment,
      date: new Date().toISOString() // Always use current date and time
    };

    const newPayments = [...currentPayments, paymentWithDate];
    const newTotalPaid = totalPaid + payment.amount;
    const newRemainingBalance = Number(sale.total) - newTotalPaid;

    // Update status: if remaining balance is 0 or less, mark as completed
    const newStatus = newRemainingBalance <= 0 ? "completed" : "pending";

    const updatedSale = await prisma.sale.update({
      where: { id: saleId },
      data: {
        payments: newPayments as any,
        remainingBalance: newRemainingBalance,
        status: newStatus as any,
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

      // Skip invalid payments
      if (!payment.amount || payment.amount <= 0 || isNaN(Number(payment.amount))) {
        logger.warn(`Skipping invalid payment amount: ${payment.amount} for sale ${sale.id}`);
      } else {
        const paymentDate = payment.date ? new Date(payment.date) : sale.date;
        const amount = Number(payment.amount);

        // Update balance only for cash, bank_transfer, or card payments (not credit)
        if (payment.type === "cash") {
          await balanceManagementService.updateCashBalance(
            paymentDate,
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
        } else if (payment.type === "bank_transfer" || payment.type === "card") {
          const bankAccountId = payment.bankAccountId || payment.cardId || sale.bankAccountId;
          if (bankAccountId) {
            await balanceManagementService.updateBankBalance(
              bankAccountId,
              paymentDate,
              amount,
              "income",
              {
                description: `Sale Payment - Bill #${sale.billNumber}${sale.customerName ? ` - ${sale.customerName}` : ""}${payment.type === "card" ? " (Card)" : ""}`,
                source: "sale_payment",
                sourceId: sale.id,
                userId: userId || "system",
                userName: userName,
              }
            );
            logger.info(`Updated bank balance: +${amount} for sale payment ${sale.billNumber}, bank: ${bankAccountId}`);
          } else {
            logger.warn(`Skipping ${payment.type} payment without bankAccountId for sale ${sale.billNumber}`);
          }
        }
        // Note: credit payments don't create balance transactions (they're future payments)
      }
    } catch (error: any) {
      logger.error("Error updating balance for sale payment:", error);
      // Re-throw to ensure the error is propagated
      throw new Error(`Failed to update balance for sale payment: ${error.message}`);
    }

    // Update customer due amount
    if (sale.customerId) {
      const oldDue = Number(sale.customer?.dueAmount || 0);
      const newDue = oldDue - payment.amount;

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

