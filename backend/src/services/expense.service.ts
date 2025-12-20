import prisma from "../config/database";
import logger from "../utils/logger";

class ExpenseService {
  async getExpenses(filters: {
    startDate?: string;
    endDate?: string;
    category?: string;
    search?: string;
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

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.search) {
      where.description = { contains: filters.search, mode: "insensitive" };
    }

    const page = filters.page || 1;
    const pageSize = filters.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          card: true,
          bankAccount: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.expense.count({ where }),
    ]);

    // Get summary statistics (all-time totals and category totals)
    const [allTimeTotals, categoryTotals] = await Promise.all([
      this.getAllTimeTotals(),
      this.getCategoryTotals(),
    ]);

    return {
      data: expenses,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      summary: {
        totalAmount: allTimeTotals.totalAmount,
        totalCount: allTimeTotals.totalCount,
        categoryTotals: categoryTotals,
      },
    };
  }

  async getExpense(id: string) {
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        card: true,
        bankAccount: true,
      },
    });

    if (!expense) {
      throw new Error("Expense not found");
    }

    return expense;
  }

  async createExpense(
    data: {
      amount: number;
      category: string;
      description?: string;
      paymentType?: string;
      cardId?: string;
      bankAccountId?: string;
      date?: string;
    },
    userId: string,
    userType?: "user" | "admin"
  ) {
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

    const expenseData: any = {
      amount: data.amount,
      category: data.category as any,
      paymentType: (data.paymentType || "cash") as any,
      cardId: data.cardId || null,
      bankAccountId: data.bankAccountId || null,
      date: data.date ? new Date(data.date) : new Date(),
      userId: user.id,
      userName: user.name,
      createdBy: user.id,
      createdByType: userTypeToUse,
    };

    // Only include description if it's provided and not empty
    if (data.description && data.description.trim().length > 0) {
      expenseData.description = data.description.trim();
    }

    const expense = await prisma.expense.create({
      data: expenseData,
      include: {
        card: true,
        bankAccount: true,
      },
    });

    return expense;
  }

  async updateExpense(
    id: string,
    data: {
      amount?: number;
      category?: string;
      description?: string;
      paymentType?: string;
      cardId?: string;
      bankAccountId?: string;
      date?: string;
    }
  ) {
    const expense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!expense) {
      throw new Error("Expense not found");
    }

    const updateData: any = {};
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.category !== undefined) updateData.category = data.category as any;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.paymentType !== undefined) updateData.paymentType = data.paymentType as any;
    if (data.cardId !== undefined) updateData.cardId = data.cardId || null;
    if (data.bankAccountId !== undefined) updateData.bankAccountId = data.bankAccountId || null;
    if (data.date !== undefined) updateData.date = new Date(data.date);

    const updatedExpense = await prisma.expense.update({
      where: { id },
      data: updateData,
      include: {
        card: true,
        bankAccount: true,
      },
    });

    return updatedExpense;
  }

  async deleteExpense(id: string) {
    const expense = await prisma.expense.findUnique({
      where: { id },
    });

    if (!expense) {
      throw new Error("Expense not found");
    }

    await prisma.expense.delete({
      where: { id },
    });
  }

  async canUserModify(expenseId: string, userId: string, userRole: string) {
    const expense = await prisma.expense.findUnique({
      where: { id: expenseId },
    });

    if (!expense) {
      throw new Error("Expense not found");
    }

    // User can modify if it's their own expense or if they're admin/superadmin
    return expense.userId === userId || userRole === "superadmin" || userRole === "admin";
  }

  async getAllTimeTotals() {
    const result = await prisma.expense.aggregate({
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    });

    return {
      totalAmount: result._sum.amount || 0,
      totalCount: result._count.id || 0,
    };
  }

  async getCategoryTotals() {
    const expenses = await prisma.expense.findMany({
      select: {
        category: true,
        amount: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const categoryTotals: Record<string, { total: number; count: number }> = {};

    expenses.forEach((expense) => {
      const category = expense.category;
      const amount = typeof expense.amount === 'number' 
        ? expense.amount 
        : parseFloat(String(expense.amount)) || 0;

      if (!categoryTotals[category]) {
        categoryTotals[category] = { total: 0, count: 0 };
      }
      categoryTotals[category].total += amount;
      categoryTotals[category].count += 1;
    });

    return categoryTotals;
  }
}

export default new ExpenseService();

