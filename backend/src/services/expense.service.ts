import prisma from "../config/database";
import logger from "../utils/logger";

class ExpenseService {
  async getExpenses(filters: {
    startDate?: string;
    endDate?: string;
    category?: string;
    search?: string;
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

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
        card: true,
        bankAccount: true,
      },
      orderBy: { date: "desc" },
    });

    return expenses;
  }

  async getExpense(id: string) {
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
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
      description: string;
      paymentType?: string;
      cardId?: string;
      bankAccountId?: string;
      date?: string;
    },
    userId: string
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const expense = await prisma.expense.create({
      data: {
        amount: data.amount,
        category: data.category as any,
        description: data.description,
        paymentType: (data.paymentType || "cash") as any,
        cardId: data.cardId || null,
        bankAccountId: data.bankAccountId || null,
        date: data.date ? new Date(data.date) : new Date(),
        userId: user.id,
        userName: user.name,
      },
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
}

export default new ExpenseService();

