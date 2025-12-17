import prisma from "../config/database";
import logger from "../utils/logger";
import whatsappService from "./whatsapp.service";
import productService from "./product.service";

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

      return {
        data: sales,
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

      return sale;
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

      return sale;
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
        tax?: number;
        taxType?: "percent" | "value";
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
      tax?: number;
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


      const effectivePrice = item.customPrice || (product.salePrice ? Number(product.salePrice) : 0);
      const unitPrice = product.salePrice ? Number(product.salePrice) : 0;
      const itemSubtotal = effectivePrice * item.quantity;
      
      // Calculate discount based on type
      let itemDiscount = 0;
      if (item.discount && item.discount > 0) {
        if (item.discountType === "value") {
          itemDiscount = item.discount;
        } else {
          itemDiscount = (itemSubtotal * item.discount) / 100;
        }
      }
      
      // Calculate tax based on type
      let itemTax = 0;
      if (item.tax && item.tax > 0) {
        if (item.taxType === "value") {
          itemTax = item.tax;
        } else {
          itemTax = (itemSubtotal * item.tax) / 100;
        }
      } else if (data.tax && data.tax > 0) {
        itemTax = (itemSubtotal * data.tax) / 100;
      }
      
      const itemTotal = itemSubtotal - itemDiscount + itemTax;

      subtotal += itemSubtotal;

      // Check if selling from warehouse or shop
      const fromWarehouse = item.fromWarehouse || false;
      // Handle both old schema (quantity) and new schema (shopQuantity/warehouseQuantity)
      const availableQuantity = fromWarehouse
        ? (product.warehouseQuantity ?? 0)
        : (product.shopQuantity ?? (product as any).quantity ?? 0);

      if (availableQuantity < item.quantity) {
        throw new Error(
          `Insufficient ${fromWarehouse ? "warehouse" : "shop"} stock for ${product.name}. Available: ${availableQuantity}`
        );
      }

      saleItems.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: unitPrice,
        customPrice: item.customPrice || null,
        discount: item.discount || 0,
        discountType: item.discountType || "percent",
        tax: itemTax,
        taxType: item.taxType || "percent",
        total: itemTotal,
        fromWarehouse: fromWarehouse,
      });
    }

    const discountAmount = (subtotal * (data.discount || 0)) / 100;
    const taxAmount = (subtotal * (data.tax || 0)) / 100;
    const total = subtotal - discountAmount + taxAmount;

    // Get or create customer (optional - use default if not provided)
    const customerName = data.customerName || "Walk-in Customer";
    const customerPhone = data.customerPhone || "0000000000";
    const customerCity = data.customerCity || null;

    let customer = await prisma.customer.findFirst({
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

    const customerId = customer.id;

    // Handle payments - support both old single payment and new multiple payments
    let payments: Array<{
      type: "cash" | "card" | "credit" | "bank_transfer";
      amount: number;
      cardId?: string;
      bankAccountId?: string;
    }> = [];
    let remainingBalance = total;

    if (data.payments && data.payments.length > 0) {
      // New multiple payments format
      payments = data.payments;
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
      }];
    }

    // Determine status based on remaining balance
    const saleStatus = remainingBalance > 0 ? "pending" : "completed";

    // Create sale with items
    const sale = await prisma.sale.create({
      data: {
        billNumber,
        subtotal,
        discount: discountAmount,
        tax: taxAmount,
        total,
        paymentType: payments[0]?.type || ("cash" as any),
        payments: payments as any,
        remainingBalance: remainingBalance,
        status: saleStatus as any,
        bankAccountId: payments.find(p => p.type === "bank_transfer")?.bankAccountId || data.bankAccountId || null,
        customerId: customerId || null,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
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

    // Update customer due amount if there's remaining balance
    if (remainingBalance > 0) {
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
        // Handle both old and new schema
        if (saleItem.fromWarehouse) {
          if ('warehouseQuantity' in productForUpdate) {
            updateData.warehouseQuantity = {
              decrement: item.quantity,
            };
          }
        } else {
          if ('shopQuantity' in productForUpdate) {
            updateData.shopQuantity = {
              decrement: item.quantity,
            };
          } else {
            // Fallback to old schema
            updateData.quantity = {
              decrement: item.quantity,
            };
          }
        }

        const updatedProduct = await prisma.product.update({
          where: { id: item.productId },
          data: updateData,
        });

        // Check low stock notifications (send/reset)
        await productService.checkAndNotifyLowStock(updatedProduct.id);
      }
    }

    // Send WhatsApp notification if customer phone number exists and payment is completed
    if (sale.customerPhone && sale.status === "completed" && sale.customerPhone !== "0000000000") {
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
        if (item.fromWarehouse && 'warehouseQuantity' in product) {
          updateData.warehouseQuantity = {
            increment: item.quantity,
          };
        } else if (!item.fromWarehouse && 'shopQuantity' in product) {
          updateData.shopQuantity = {
            increment: item.quantity,
          };
        } else {
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

    // Add date to payment if not provided
    const paymentWithDate = {
      ...payment,
      date: payment.date ? new Date(payment.date).toISOString() : new Date().toISOString()
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
    if (updatedSale.customerPhone && updatedSale.customerPhone !== "0000000000") {
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

