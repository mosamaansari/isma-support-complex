import prisma from "../config/database";
import logger from "../utils/logger";
import { validateTodayDate } from "../utils/dateValidation";

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
    // Validate that date is today (if provided)
    validateTodayDate(data.date, 'expense date');

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

    // Check balance from daily closing balance BEFORE creating expense
    const dailyClosingBalanceService = (await import("./dailyClosingBalance.service")).default;
    const { formatLocalYMD } = await import("../utils/date");
    
    // Use expense date if provided, otherwise use current date
    const expenseDate = data.date ? new Date(data.date) : new Date();
    const expenseDateStr = formatLocalYMD(expenseDate); // YYYY-MM-DD format in local timezone
    
    // Get or calculate closing balance for expense date
    const closingBalance = await dailyClosingBalanceService.getClosingBalance(expenseDateStr);

    if (data.paymentType === "cash") {
      const availableCash = closingBalance?.cashBalance || 0;
      if (availableCash < data.amount) {
        throw new Error(`Insufficient cash balance. Available: ${availableCash.toFixed(2)}, Required: ${data.amount.toFixed(2)}`);
      }
    } else if (data.bankAccountId) {
      const bankBalances = (closingBalance?.bankBalances || []) as Array<{ bankAccountId: string; balance: number }>;
      const bankBalance = bankBalances.find(b => b.bankAccountId === data.bankAccountId);
      const availableBankBalance = bankBalance ? Number(bankBalance.balance) : 0;
      if (availableBankBalance < data.amount) {
        throw new Error(`Insufficient bank balance. Available: ${availableBankBalance.toFixed(2)}, Required: ${data.amount.toFixed(2)}`);
      }
    } else if (data.cardId) {
      const cardBalances = (closingBalance?.cardBalances || []) as Array<{ cardId: string; balance: number }>;
      const cardBalance = cardBalances.find(c => c.cardId === data.cardId);
      const availableCardBalance = cardBalance ? Number(cardBalance.balance) : 0;
      if (availableCardBalance < data.amount) {
        throw new Error(`Insufficient card balance. Available: ${availableCardBalance.toFixed(2)}, Required: ${data.amount.toFixed(2)}`);
      }
    }

    // Always use current date and time for expense
    const expenseData: any = {
      amount: data.amount,
      category: data.category as any,
      paymentType: (data.paymentType || "cash") as any,
      cardId: data.cardId || null,
      bankAccountId: data.bankAccountId || null,
      date: new Date(), // Always use current date and time
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

    // Update balance atomically for expense using balance management service
    // Balance already validated above, now update after successful creation
    try {
      // Import balance management service for updating balances
      const balanceManagementService = (await import("./balanceManagement.service")).default;
      
      // Extract date components from expense.date in local timezone to avoid timezone conversion issues
      // This ensures the same date that was intended is stored in balance_transactions
      const expenseDate = new Date(expense.date);
      const dateYear = expenseDate.getFullYear();
      const dateMonth = expenseDate.getMonth();
      const dateDay = expenseDate.getDate();
      // Create a date object using local date components (will be normalized by balance management service)
      const expenseDateForBalance = new Date(dateYear, dateMonth, dateDay);

      if (expense.paymentType === "cash") {
        await balanceManagementService.updateCashBalance(
          expenseDateForBalance,
          Number(expense.amount),
          "expense",
          {
            description: expense.description || `Expense - ${expense.category}`,
            source: "expense",
            sourceId: expense.id,
            userId: user.id,
            userName: user.name,
          }
        );
      } else if (expense.bankAccountId) {
        await balanceManagementService.updateBankBalance(
          expense.bankAccountId,
          expenseDateForBalance,
          Number(expense.amount),
          "expense",
          {
            description: expense.description || `Expense - ${expense.category}`,
            source: "expense",
            sourceId: expense.id,
            userId: user.id,
            userName: user.name,
          }
        );
      } else if (expense.cardId) {
        await balanceManagementService.updateCardBalance(
          expense.cardId,
          expenseDateForBalance,
          Number(expense.amount),
          "expense",
          {
            description: expense.description || `Expense - ${expense.category}`,
            source: "expense",
            sourceId: expense.id,
            userId: user.id,
            userName: user.name,
          }
        );
      }

      // Recalculate closing balance for today to include the new expense
      try {
        const dailyClosingBalanceService = (await import("./dailyClosingBalance.service")).default;
        const today = new Date();
        await dailyClosingBalanceService.calculateAndStoreClosingBalance(today);
        logger.info(`Recalculated closing balance after expense creation for ${expense.id}`);
      } catch (error: any) {
        logger.error("Error recalculating closing balance after expense:", error);
        // Don't fail the expense creation if closing balance recalculation fails
        // The balance transaction is already created, so the balance is correct
      }
    } catch (error: any) {
      logger.error("Error updating balance for expense:", error);

      // Rollback: Delete the created expense since balance update failed
      try {
        await prisma.expense.delete({
          where: { id: expense.id },
        });
        logger.info(`Rolled back expense creation for ${expense.id} due to balance error`);
      } catch (deleteError) {
        logger.error(`Failed to rollback expense ${expense.id}:`, deleteError);
      }

      // Re-throw to ensure error is returned to user
      throw error;
    }

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
    // Validate that date is today (if provided)
    validateTodayDate(data.date, 'expense date');

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
    // Don't allow date updates - always use current date
    // if (data.date !== undefined) updateData.date = new Date(data.date);

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

