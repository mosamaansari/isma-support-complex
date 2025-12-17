import prisma from "../config/database";
import logger from "../utils/logger";
import productService from "./product.service";

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
          orderBy: { date: "desc" },
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
    userId: string,
    userType?: "user" | "admin"
  ) {
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

    // Calculate total paid amount
    const totalPaid = data.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const remainingBalance = data.total - totalPaid;

    if (totalPaid > data.total) {
      throw new Error("Total paid amount cannot exceed total amount");
    }

    // Set status based on remaining balance
    const status = remainingBalance > 0 ? "pending" : "completed";

    // Create purchase with items (store name and phone, not supplierId)
    const purchase = await prisma.purchase.create({
      data: {
        supplierId: null, // Don't use supplierId, just store name and phone
        supplierName: data.supplierName,
        supplierPhone: data.supplierPhone || null,
        subtotal: data.subtotal,
        tax: data.tax || 0,
        total: data.total,
        payments: data.payments as any,
        remainingBalance: remainingBalance,
        status: status as any,
        date: data.date ? new Date(data.date) : new Date(),
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

    // Prevent edits on completed purchases
    if (purchase.status === "completed") {
      throw new Error("Completed purchases cannot be edited");
    }

    const updateData: any = {};

    // Update supplier if name changed
    // Update supplier name/phone (store in purchase, not linked via ID)
    if (data.supplierName) {
      updateData.supplierName = data.supplierName;
      updateData.supplierId = null; // Don't use supplierId, just store name and phone
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
        const product = await prisma.product.findUnique({ where: { id: oldItem.productId } });
        if (product) {
          if (oldItem.toWarehouse) {
            await prisma.product.update({
              where: { id: product.id },
              data: { warehouseQuantity: { decrement: oldItem.quantity } },
            });
          } else {
            await prisma.product.update({
              where: { id: product.id },
              data: { shopQuantity: { decrement: oldItem.quantity } },
            });
          }
        }
      }

      // Delete old items
      await prisma.purchaseItem.deleteMany({
        where: { purchaseId: id },
      });

      // 2) Create new items and apply stock increments
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

        // Apply stock increment based on destination
        if (item.toWarehouse !== false) {
          await prisma.product.update({
            where: { id: product.id },
            data: { warehouseQuantity: { increment: item.quantity } },
          });
        } else {
          await prisma.product.update({
            where: { id: product.id },
            data: { shopQuantity: { increment: item.quantity } },
          });
        }
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
      const purchaseTotal = data.total !== undefined ? Number(data.total) : Number(purchase.total);
      if (totalPaid > purchaseTotal) {
        throw new Error("Total paid amount cannot exceed total amount");
      }
      updateData.remainingBalance = purchaseTotal - totalPaid;
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
    const newPayments = [...currentPayments, { ...payment, date: payment.date ? new Date(payment.date) : new Date() }];
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

    // Supplier table is maintained for listing only, not linked to purchases via ID

    return updatedPurchase;
  }
}

export default new PurchaseService();

