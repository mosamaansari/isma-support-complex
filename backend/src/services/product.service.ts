import prisma from "../config/database";
import logger from "../utils/logger";

class ProductService {
  async getProducts(filters: {
    search?: string;
    category?: string;
    lowStock?: boolean;
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

    const products = await prisma.product.findMany({
      where,
      include: {
        categoryRef: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (filters.lowStock === true) {
      return products.filter((p) => {
        const totalQty = 
          ('shopQuantity' in p ? p.shopQuantity : 0) + 
          ('warehouseQuantity' in p ? p.warehouseQuantity : 0) +
          (!('shopQuantity' in p) && !('warehouseQuantity' in p) && 'quantity' in p ? (p as any).quantity : 0);
        return totalQty <= p.minStockLevel;
      });
    }

    return products;
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

    // Filter products where total quantity (shop + warehouse) is less than minStockLevel
    return products.filter(
      (p) => p.shopQuantity + p.warehouseQuantity <= p.minStockLevel
    );
  }
}

export default new ProductService();

