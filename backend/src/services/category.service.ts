import prisma from "../config/database";
import logger from "../utils/logger";

class CategoryService {
  async getCategories() {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
    });

    return categories;
  }

  async getCategory(id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new Error("Category not found");
    }

    return category;
  }

  async createCategory(data: { name: string; description?: string }) {
    // Check if category already exists
    const existingCategory = await prisma.category.findUnique({
      where: { name: data.name.trim() },
    });

    if (existingCategory) {
      throw new Error("Category already exists");
    }

    const category = await prisma.category.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
      },
    });

    return category;
  }

  async updateCategory(id: string, data: { name?: string; description?: string }) {
    const category = await prisma.category.findUnique({
      where: { id },
    });

    if (!category) {
      throw new Error("Category not found");
    }

    // Check if name is being changed and if new name already exists
    if (data.name && data.name.trim() !== category.name) {
      const existingCategory = await prisma.category.findUnique({
        where: { name: data.name.trim() },
      });

      if (existingCategory) {
        throw new Error("Category name already exists");
      }
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;

    const updatedCategory = await prisma.category.update({
      where: { id },
      data: updateData,
    });

    return updatedCategory;
  }

  async deleteCategory(id: string) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        products: true,
      },
    });

    if (!category) {
      throw new Error("Category not found");
    }

    // Check if category is being used by any products
    if (category.products.length > 0) {
      throw new Error(
        `Cannot delete category. It is being used by ${category.products.length} product(s)`
      );
    }

    await prisma.category.delete({
      where: { id },
    });
  }
}

export default new CategoryService();


