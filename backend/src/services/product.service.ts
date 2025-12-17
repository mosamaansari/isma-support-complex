import prisma from "../config/database";
import logger from "../utils/logger";
import emailService from "./email.service";

const isLowStockByLocation = (product: any) => {
  const shopThreshold = product.shopMinStockLevel ?? product.minStockLevel ?? 0;
  const warehouseThreshold = product.warehouseMinStockLevel ?? product.minStockLevel ?? 0;

  const shopQty = product.shopQuantity ?? 0;
  const warehouseQty = product.warehouseQuantity ?? 0;

  const shopLow = shopThreshold > 0 ? shopQty <= shopThreshold : false;
  const warehouseLow = warehouseThreshold > 0 ? warehouseQty <= warehouseThreshold : false;

  return { shopLow, warehouseLow, isLow: shopLow || warehouseLow };
};

class ProductService {
  async getProducts(filters: {
    search?: string;
    category?: string;
    lowStock?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const where: any = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { category: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    if (filters.category) {
      where.category = { contains: filters.category, mode: "insensitive" };
    }

    const page = filters.page || 1;
    const pageSize = filters.pageSize || 10;
    const skip = (page - 1) * pageSize;

    let products = await prisma.product.findMany({
      where,
      include: {
        categoryRef: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });

    if (filters.lowStock === true) {
      products = products.filter((p) => isLowStockByLocation(p).isLow);
    }

    const total = await prisma.product.count({ where });

    return {
      data: products,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getProduct(id: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        categoryRef: true,
      },
    });

    if (!product) {
      throw new Error("Product not found");
    }

    return product;
  }

  async createProduct(data: {
    name: string;
    category?: string;
    categoryId?: string;
    salePrice?: number;
    shopQuantity: number;
    warehouseQuantity: number;
    minStockLevel?: number;
    model?: string;
    manufacturer?: string;
    barcode?: string;
    image?: string;
    description?: string;
  }) {
    // Try to find category by name or use categoryId
    let categoryId = null;
    if (data.categoryId) {
      categoryId = data.categoryId;
    } else if (data.category) {
      const category = await prisma.category.findFirst({
        where: { name: { equals: data.category, mode: "insensitive" } },
      });
      if (category) {
        categoryId = category.id;
      }
    }

    const product = await prisma.product.create({
      data: {
        name: data.name,
        category: data.category || null,
        categoryId: categoryId,
        salePrice: data.salePrice || null,
        shopQuantity: data.shopQuantity,
        warehouseQuantity: data.warehouseQuantity,
        minStockLevel: data.minStockLevel || 10,
        model: data.model || null,
        manufacturer: data.manufacturer || null,
        barcode: data.barcode || null,
        image: data.image || null,
        description: data.description || null,
      },
      include: {
        categoryRef: true,
      },
    });

    return product;
  }

  async updateProduct(
    id: string,
    data: {
      name?: string;
      category?: string;
      categoryId?: string;
      salePrice?: number;
      shopQuantity?: number;
      warehouseQuantity?: number;
      minStockLevel?: number;
      model?: string;
      manufacturer?: string;
      barcode?: string;
      image?: string;
      description?: string;
    }
  ) {
    // Try to find category by name or use categoryId
    let categoryId = undefined;
    if (data.categoryId) {
      categoryId = data.categoryId;
    } else if (data.category !== undefined) {
      if (data.category) {
        const category = await prisma.category.findFirst({
          where: { name: { equals: data.category, mode: "insensitive" } },
        });
        if (category) {
          categoryId = category.id;
        }
      } else {
        categoryId = null;
      }
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.category !== undefined) updateData.category = data.category || null;
    if (categoryId !== undefined) updateData.categoryId = categoryId;
    if (data.salePrice !== undefined) updateData.salePrice = data.salePrice || null;
    if (data.shopQuantity !== undefined) updateData.shopQuantity = data.shopQuantity;
    if (data.warehouseQuantity !== undefined) updateData.warehouseQuantity = data.warehouseQuantity;
    if (data.minStockLevel !== undefined) updateData.minStockLevel = data.minStockLevel;
    if (data.model !== undefined) updateData.model = data.model || null;
    if (data.manufacturer !== undefined) updateData.manufacturer = data.manufacturer || null;
    if (data.barcode !== undefined) updateData.barcode = data.barcode || null;
    if (data.image !== undefined) updateData.image = data.image || null;
    if (data.description !== undefined) updateData.description = data.description || null;

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        categoryRef: true,
      },
    });

    // Check for low stock alerts (notify/reset)
    await this.checkAndNotifyLowStock(product.id);

    return product;
  }

  async deleteProduct(id: string) {
    await prisma.product.delete({
      where: { id },
    });
  }

  async getLowStockProducts() {
    const products = await prisma.product.findMany({
      include: {
        categoryRef: true,
      },
    });

    // Filter products where either shop or warehouse is at/below its threshold
    return products.filter((p) => isLowStockByLocation(p).isLow);
  }

  /**
   * Check current stock vs minStockLevel and send/reset low stock notification.
   * - Sends email to superadmins when stock drops to or below min and no notification sent yet.
   * - Resets notification flag when stock rises above min.
   */
  async checkAndNotifyLowStock(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        shopQuantity: true,
        warehouseQuantity: true,
        shopMinStockLevel: true,
        warehouseMinStockLevel: true,
        minStockLevel: true,
        lowStockNotifiedAt: true,
      },
    });

    if (!product) return;

    const { shopLow, warehouseLow, isLow } = isLowStockByLocation(product);

    // If stock is above min, reset notification flag
    if (!isLow) {
      if (product.lowStockNotifiedAt) {
        await prisma.product.update({
          where: { id: productId },
          data: { lowStockNotifiedAt: null },
        });
      }
      return;
    }

    // Stock is at/below min — send notification only if not already sent
    if (!product.lowStockNotifiedAt) {
      try {
        const superAdmins = await prisma.adminUser.findMany({
          where: {
            role: "superadmin",
            email: { not: null },
          },
          select: { email: true, name: true },
        });

        const payload = [
          {
            name: product.name,
            currentStock: (product.shopQuantity ?? 0) + (product.warehouseQuantity ?? 0),
            minStock: Math.min(
              product.shopMinStockLevel ?? product.minStockLevel ?? 0,
              product.warehouseMinStockLevel ?? product.minStockLevel ?? 0,
              product.minStockLevel ?? 0
            ),
          },
        ];

        for (const admin of superAdmins) {
          if (admin.email) {
            await emailService.sendLowStockAlertEmail(
              admin.email,
              admin.name || "Super Admin",
              payload
            );
          }
        }

        // Mark notification sent
        await prisma.product.update({
          where: { id: productId },
          data: { lowStockNotifiedAt: new Date() },
        });
      } catch (error) {
        logger.error("Error sending low stock alert:", error);
      }
    }
  }
}

export default new ProductService();

