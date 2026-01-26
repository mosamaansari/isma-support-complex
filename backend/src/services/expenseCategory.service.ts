import prisma from "../config/database";

class ExpenseCategoryService {
  async getExpenseCategories() {
    const categories = await prisma.expenseCategory.findMany({
      orderBy: { createdAt: "desc" },
    });

    return categories;
  }

  async getExpenseCategory(id: string) {
    const category = await prisma.expenseCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new Error("Expense category not found");
    }

    return category;
  }

  async createExpenseCategory(data: { name: string; description?: string }) {
    // Check if expense category already exists
    const existingCategory = await prisma.expenseCategory.findUnique({
      where: { name: data.name.trim() },
    });

    if (existingCategory) {
      throw new Error("Expense category already exists");
    }

    const category = await prisma.expenseCategory.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
      },
    });

    return category;
  }

  async updateExpenseCategory(id: string, data: { name?: string; description?: string }) {
    
    const category = await prisma.expenseCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new Error("Expense category not found");
    }

    // If name is being updated, check if it's unique
    if (data.name && data.name.trim() !== category.name) {
      const existingCategory = await prisma.expenseCategory.findUnique({
        where: { name: data.name.trim() },
      });

      if (existingCategory) {
        throw new Error("Expense category name already exists");
      }
    }

    const updatedCategory = await prisma.expenseCategory.update({
      where: { id },
      data: {
        name: data.name?.trim() || category.name,
        description: data.description !== undefined ? (data.description?.trim() || null) : category.description,
      },
    });

    return updatedCategory;
  }

  async deleteExpenseCategory(id: string) {
    const category = await prisma.expenseCategory.findUnique({
      where: { id },
      include: {
        expenses: true,
      },
    });

    if (!category) {
      throw new Error("Expense category not found");
    }

    // Check if category is in use
    if (category.expenses.length > 0) {
      throw new Error("Cannot delete expense category that is in use by expenses");
    }

    await prisma.expenseCategory.delete({
      where: { id },
    });

    return { message: "Expense category deleted successfully" };
  }
}

export default new ExpenseCategoryService();

