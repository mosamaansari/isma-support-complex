import prisma from "../config/database";
import logger from "../utils/logger";

class SaleService {
  async getSales(filters: {
    startDate?: string;
    endDate?: string;
    status?: string;
    search?: string;
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

    try {
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
          card: true,
          bankAccount: true,
        },
        orderBy: { createdAt: "desc" },
      });
      return sales;
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
          user: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
          customer: true,
          card: true,
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
            user: {
              select: {
                id: true,
                name: true,
                username: true,
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
          user: {
            select: {
              id: true,
              name: true,
              username: true,
            },
          },
          customer: true,
          card: true,
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
        discount?: number;
        fromWarehouse?: boolean;
      }>;
      customerName?: string;
      customerPhone?: string;
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
    userId: string
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

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

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


      const unitPrice = product.salePrice ? Number(product.salePrice) : 0;
      const itemSubtotal = unitPrice * item.quantity;
      const itemDiscount = (itemSubtotal * (item.discount || 0)) / 100;
      const itemTax = (itemSubtotal * (data.tax || 0)) / 100;
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
        unitPrice: product.salePrice || 0,
        discount: item.discount || 0,
        tax: itemTax,
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

    let customer = await prisma.customer.findFirst({
      where: { phone: customerPhone },
    });

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: customerName,
          phone: customerPhone,
        },
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
      const paymentType = (data.paymentType || "cash") as "cash" | "card" | "credit" | "bank_transfer";
      const paymentAmount = paymentType === "credit" ? 0 : total;
      remainingBalance = paymentType === "credit" ? total : 0;
      
      payments = [{
        type: paymentType,
        amount: paymentAmount,
        cardId: data.cardId || undefined,
        bankAccountId: data.bankAccountId || undefined,
      }];
    }

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
        cardId: payments.find(p => p.type === "card")?.cardId || data.cardId || null,
        bankAccountId: payments.find(p => p.type === "bank_transfer")?.bankAccountId || data.bankAccountId || null,
        customerId: customerId || null,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        date: data.date ? new Date(data.date) : new Date(),
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

        await prisma.product.update({
          where: { id: item.productId },
          data: updateData,
        });
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

        await prisma.product.update({
          where: { id: item.productId },
          data: updateData,
        });
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
    }
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
    }>) || [];
    
    const totalPaid = currentPayments.reduce((sum, p) => sum + p.amount, 0);
    const currentRemaining = Number(sale.remainingBalance);

    if (payment.amount > currentRemaining) {
      throw new Error("Payment amount exceeds remaining balance");
    }

    const newPayments = [...currentPayments, payment];
    const newTotalPaid = totalPaid + payment.amount;
    const newRemainingBalance = Number(sale.total) - newTotalPaid;

    const updatedSale = await prisma.sale.update({
      where: { id: saleId },
      data: {
        payments: newPayments as any,
        remainingBalance: newRemainingBalance,
        // Update paymentType to the latest payment type for backward compatibility
        paymentType: payment.type as any,
        cardId: payment.type === "card" ? payment.cardId || sale.cardId : sale.cardId,
        bankAccountId: payment.type === "bank_transfer" ? payment.bankAccountId || sale.bankAccountId : sale.bankAccountId,
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

    return updatedSale;
  }
}

export default new SaleService();

