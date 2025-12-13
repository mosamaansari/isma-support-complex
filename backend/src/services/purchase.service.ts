import prisma from "../config/database";
import logger from "../utils/logger";

class PurchaseService {
  async getPurchases(filters: {
    startDate?: string;
    endDate?: string;
    supplierId?: string;
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

    try {
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
      return purchases;
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
        discount?: number;
        toWarehouse?: boolean;
      }>;
      subtotal: number;
      tax?: number;
      total: number;
      payments: Array<{
        type: "cash" | "card";
        amount: number;
        cardId?: string;
        bankAccountId?: string;
      }>;
      date?: string;
    },
    userId: string
  ) {
    // Get or create supplier
    let supplier = await prisma.supplier.findFirst({
      where: { name: { equals: data.supplierName, mode: "insensitive" } },
    });

    if (!supplier) {
      supplier = await prisma.supplier.create({
        data: {
          name: data.supplierName,
          phone: data.supplierPhone || "",
        },
      });
    } else if (data.supplierPhone && data.supplierPhone !== supplier.phone) {
      // Update phone if provided and different
      supplier = await prisma.supplier.update({
        where: { id: supplier.id },
        data: { phone: data.supplierPhone },
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

      const itemSubtotal = item.cost * item.quantity;
      const itemDiscount = (itemSubtotal * (item.discount || 0)) / 100;
      const itemTotal = itemSubtotal - itemDiscount;

      purchaseItems.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        cost: item.cost,
        discount: item.discount || 0,
        total: itemTotal,
        toWarehouse: item.toWarehouse !== undefined ? item.toWarehouse : true,
      });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Calculate total paid amount
    const totalPaid = data.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const remainingBalance = data.total - totalPaid;

    // Create purchase with items
    const purchase = await prisma.purchase.create({
      data: {
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierPhone: data.supplierPhone || null,
        subtotal: data.subtotal,
        tax: data.tax || 0,
        total: data.total,
        payments: data.payments as any,
        remainingBalance: remainingBalance,
        date: data.date ? new Date(data.date) : new Date(),
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

    // Update product quantities (shop or warehouse)
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      const purchaseItem = purchaseItems[i];
      const updateData: any = {};

      const productForUpdate = await prisma.product.findUnique({
        where: { id: item.productId },
      });

      if (productForUpdate) {
        if (purchaseItem.toWarehouse) {
          if ('warehouseQuantity' in productForUpdate) {
            updateData.warehouseQuantity = { increment: item.quantity };
          } else {
            updateData.quantity = { increment: item.quantity };
          }
        } else {
          if ('shopQuantity' in productForUpdate) {
            updateData.shopQuantity = { increment: item.quantity };
          } else {
            updateData.quantity = { increment: item.quantity };
          }
        }

        await prisma.product.update({
          where: { id: item.productId },
          data: updateData,
        });
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
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });

    if (!purchase) {
      throw new Error("Purchase not found");
    }

    return purchase;
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
        discount?: number;
        toWarehouse?: boolean;
      }>;
      subtotal?: number;
      tax?: number;
      total?: number;
      payments?: Array<{
        type: "cash" | "card";
        amount: number;
        cardId?: string;
        bankAccountId?: string;
      }>;
      date?: string;
    },
    userId: string
  ) {
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: { items: true, supplier: true },
    });

    if (!purchase) {
      throw new Error("Purchase not found");
    }

    const updateData: any = {};

    // Update supplier if name changed
    if (data.supplierName && data.supplierName !== purchase.supplierName) {
      let supplier = await prisma.supplier.findFirst({
        where: { name: { equals: data.supplierName, mode: "insensitive" } },
      });

      if (!supplier) {
        supplier = await prisma.supplier.create({
          data: {
            name: data.supplierName,
            phone: data.supplierPhone || "",
          },
        });
      }

      updateData.supplierId = supplier.id;
      updateData.supplierName = supplier.name;
      if (data.supplierPhone) {
        updateData.supplierPhone = data.supplierPhone;
      }
    } else if (data.supplierPhone && purchase.supplierId) {
      await prisma.supplier.update({
        where: { id: purchase.supplierId },
        data: { phone: data.supplierPhone },
      });
      updateData.supplierPhone = data.supplierPhone;
    }

    // Update items if provided
    if (data.items) {
      // Delete old items
      await prisma.purchaseItem.deleteMany({
        where: { purchaseId: id },
      });

      // Create new items
      const purchaseItems = [];
      for (const item of data.items) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new Error(`Product ${item.productId} not found`);
        }

        const itemSubtotal = item.cost * item.quantity;
        const itemDiscount = (itemSubtotal * (item.discount || 0)) / 100;
        const itemTotal = itemSubtotal - itemDiscount;

        purchaseItems.push({
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          cost: item.cost,
          discount: item.discount || 0,
          total: itemTotal,
          toWarehouse: item.toWarehouse !== undefined ? item.toWarehouse : true,
        });
      }

      updateData.items = {
        create: purchaseItems,
      };
    }

    // Update totals
    if (data.subtotal !== undefined) updateData.subtotal = data.subtotal;
    if (data.tax !== undefined) updateData.tax = data.tax;
    if (data.total !== undefined) updateData.total = data.total;
    if (data.payments) {
      updateData.payments = data.payments as any;
      // Recalculate remaining balance
      const totalPaid = data.payments.reduce((sum, payment) => sum + payment.amount, 0);
      updateData.remainingBalance = (data.total || purchase.total) - totalPaid;
    }
    if (data.date) updateData.date = new Date(data.date);

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

    return updatedPurchase;
  }

  async addPaymentToPurchase(
    purchaseId: string,
    payment: {
      type: "cash" | "card";
      amount: number;
      cardId?: string;
      bankAccountId?: string;
      date?: string;
    },
    userId: string
  ) {
    const purchase = await prisma.purchase.findUnique({
      where: { id: purchaseId },
    });

    if (!purchase) {
      throw new Error("Purchase not found");
    }

    const currentPayments = (purchase.payments as any) || [];
    const newPayments = [...currentPayments, payment];
    const totalPaid = newPayments.reduce((sum, p: any) => sum + p.amount, 0);
    const remainingBalance = purchase.total - totalPaid;

    if (remainingBalance < 0) {
      throw new Error("Payment amount exceeds remaining balance");
    }

    const updatedPurchase = await prisma.purchase.update({
      where: { id: purchaseId },
      data: {
        payments: newPayments as any,
        remainingBalance: remainingBalance,
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

    // Update supplier due amount
    if (purchase.supplierId) {
      const supplier = await prisma.supplier.findUnique({
        where: { id: purchase.supplierId },
      });
      if (supplier) {
        const oldDue = supplier.dueAmount;
        const newDue = oldDue - payment.amount;
        await prisma.supplier.update({
          where: { id: purchase.supplierId },
          data: {
            dueAmount: Math.max(0, newDue),
          },
        });
      }
    }

    return updatedPurchase;
  }
}

export default new PurchaseService();

