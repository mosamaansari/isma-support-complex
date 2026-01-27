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
          expenseCategoryRef: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.expense.count({ where }),
    ]);

    // Get summary statistics for all matching expenses (not just the paginated ones)
    const allMatchingExpenses = await prisma.expense.findMany({
      where,
      select: {
        id: true,
        amount: true,
        paymentType: true,
        category: true,
      },
    });

    // Calculate summary statistics
    const summaryStats = allMatchingExpenses.reduce(
      (acc, expense) => {
        const expenseAmount = Number(expense.amount || 0);
        
        acc.totalExpenses += expenseAmount;
        acc.totalCount += 1;
        
        // Count by payment type
        if (expense.paymentType === 'cash') {
          acc.cashExpenses += expenseAmount;
        } else if (expense.paymentType === 'bank_transfer') {
          acc.bankExpenses += expenseAmount;
        } else if (expense.paymentType === 'card') {
          acc.cardExpenses += expenseAmount;
        }
        
        // Count by category
        if (!acc.categoryTotals[expense.category]) {
          acc.categoryTotals[expense.category] = { total: 0, count: 0 };
        }
        acc.categoryTotals[expense.category].total += expenseAmount;
        acc.categoryTotals[expense.category].count += 1;
        
        return acc;
      },
      {
        totalExpenses: 0,
        totalCount: 0,
        cashExpenses: 0,
        bankExpenses: 0,
        cardExpenses: 0,
        categoryTotals: {} as Record<string, { total: number; count: number }>,
      }
    );

    return {
      data: expenses,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
      summary: summaryStats,
    };
  }

  async getExpense(id: string) {
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        card: true,
        bankAccount: true,
        expenseCategoryRef: true,
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

    // Look up expense category by name to get the ID
    let expenseCategoryId: string | null = null;
    if (data.category) {
      const expenseCategory = await prisma.expenseCategory.findUnique({
        where: { name: data.category.trim() },
      });
      if (expenseCategory) {
        expenseCategoryId = expenseCategory.id;
      }
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

    // Check balance from daily closing balance BEFORE creating expense
    const dailyClosingBalanceService = (await import("./dailyClosingBalance.service")).default;
    const { formatLocalYMD, parseLocalISO, getCurrentLocalDateTime } = await import("../utils/date");
    
    // Use expense date if provided, otherwise use current date
    // Parse date properly to avoid timezone issues - same as opening balance
    const expenseDateForCheck = data.date 
      ? parseLocalISO(data.date) 
      : getCurrentLocalDateTime();
    const expenseDateStr = formatLocalYMD(expenseDateForCheck); // YYYY-MM-DD format in local timezone
    
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

    // Use provided date if available, otherwise use current date and time
    // Parse date properly to avoid timezone issues - same as opening balance
    const expenseDateForDB = data.date 
      ? parseLocalISO(data.date) 
      : getCurrentLocalDateTime();
    
    const expenseData: any = {
      amount: data.amount,
      category: data.category,
      expenseCategoryId: expenseCategoryId,
      paymentType: (data.paymentType || "cash") as any,
      cardId: data.cardId || null,
      bankAccountId: data.bankAccountId || null,
      date: expenseDateForDB, // Use provided date or current date
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
        expenseCategoryRef: true,
      },
    });

    // Update balance atomically for expense using balance management service
    // Balance already validated above, now update after successful creation
    try {
      // Import balance management service for updating balances
      const balanceManagementService = (await import("./balanceManagement.service")).default;
      
      // Use the expense date (which is already parsed correctly above)
      // Normalize to noon (12:00:00) for @db.Date column to avoid timezone conversion issues
      // Same as opening balance - this ensures the date stored in balance_transactions matches the expense date
      const expenseDateYear = expense.date.getFullYear();
      const expenseDateMonth = expense.date.getMonth();
      const expenseDateDay = expense.date.getDate();
      const expenseDateForBalance = new Date(expenseDateYear, expenseDateMonth, expenseDateDay, 12, 0, 0, 0);

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

      // Note: Closing balance is now updated directly in balanceManagementService.updateCashBalance/updateBankBalance/updateCardBalance
      // No need to recalculate here - the direct add/subtract method handles it
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
    
    // If category is being updated, look up the expense category ID
    if (data.category !== undefined) {
      updateData.category = data.category;
      if (data.category) {
        const expenseCategory = await prisma.expenseCategory.findUnique({
          where: { name: data.category.trim() },
        });
        if (expenseCategory) {
          updateData.expenseCategoryId = expenseCategory.id;
        } else {
          updateData.expenseCategoryId = null;
        }
      } else {
        updateData.expenseCategoryId = null;
      }
    }
    
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
        expenseCategoryRef: true,
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

    // Check if expense is from today only
    const expenseDate = new Date(expense.date);
    const today = new Date();
    
    // Normalize both dates to compare only year-month-day (ignore time)
    const expenseDateStr = `${expenseDate.getFullYear()}-${String(expenseDate.getMonth() + 1).padStart(2, '0')}-${String(expenseDate.getDate()).padStart(2, '0')}`;
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    if (expenseDateStr !== todayStr) {
      throw new Error("Only today's expenses can be deleted");
    }

    // Refund the expense amount back to balance
    try {
      const balanceManagementService = (await import("./balanceManagement.service")).default;
      const { parseLocalYMDForDB, formatLocalYMD, getTodayInPakistan } = await import("../utils/date");
      
      // Use today's date for refund transaction (same as sale/purchase cancellation)
      // This ensures the refund appears in today's balance transactions and reports
      const refundDateForBalance = parseLocalYMDForDB(formatLocalYMD(getTodayInPakistan()));

      // Refund based on payment type
      if (expense.paymentType === "cash") {
        // Refund to cash balance (income transaction)
        await balanceManagementService.updateCashBalance(
          refundDateForBalance,
          Number(expense.amount),
          "income",
          {
            description: `Expense Refund - ${expense.category}${expense.description ? ` - ${expense.description}` : ""} (Deleted)`,
            source: "expense_refund",
            sourceId: expense.id,
            userId: expense.userId,
            userName: expense.userName,
          }
        );
        logger.info(`Refunded cash: +${expense.amount} for deleted expense ${expense.id}`);
      } else if (expense.paymentType === "bank_transfer" && expense.bankAccountId) {
        // Refund to bank account (income transaction)
        await balanceManagementService.updateBankBalance(
          expense.bankAccountId,
          refundDateForBalance,
          Number(expense.amount),
          "income",
          {
            description: `Expense Refund - ${expense.category}${expense.description ? ` - ${expense.description}` : ""} (Deleted)`,
            source: "expense_refund",
            sourceId: expense.id,
            userId: expense.userId,
            userName: expense.userName,
          }
        );
        logger.info(`Refunded bank balance: +${expense.amount} for deleted expense ${expense.id}, bank: ${expense.bankAccountId}`);
      }
    } catch (error: any) {
      logger.error("Error refunding balance for deleted expense:", error);
      throw new Error(`Failed to refund expense: ${error.message}`);
    }

    // Delete the expense after successful refund
    await prisma.expense.delete({
      where: { id },
    });

    logger.info(`Expense deleted and refunded successfully: ${expense.id}`);
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

