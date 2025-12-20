import prisma from "../config/database";
import logger from "../utils/logger";

interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  paymentType?: "cash" | "bank_transfer";
  bankAccountId?: string;
  type?: "income" | "expense";
}

class BalanceTransactionService {
  /**
   * Get all transactions with filters
   */
  async getTransactions(filters: TransactionFilters = {}) {
    const where: any = {};

    if (filters.startDate && filters.endDate) {
      where.date = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate),
      };
    }

    if (filters.paymentType) {
      where.paymentType = filters.paymentType;
    }

    if (filters.bankAccountId) {
      where.bankAccountId = filters.bankAccountId;
    }

    if (filters.type) {
      where.type = filters.type;
    }

    const transactions = await prisma.balanceTransaction.findMany({
      where,
      include: {
        bankAccount: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return transactions;
  }

  /**
   * Get cash transactions
   */
  async getCashTransactions(startDate?: string, endDate?: string) {
    const where: any = {
      paymentType: "cash",
    };

    if (startDate && endDate) {
      // Parse dates properly to avoid timezone issues
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      where.date = {
        gte: start,
        lte: end,
      };
    }

    const transactions = await prisma.balanceTransaction.findMany({
      where,
      include: {
        bankAccount: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return transactions;
  }

  /**
   * Get bank account transactions
   */
  async getBankTransactions(bankAccountId: string, startDate?: string, endDate?: string) {
    const where: any = {
      paymentType: "bank_transfer",
      bankAccountId,
    };

    if (startDate && endDate) {
      // Parse dates properly to avoid timezone issues
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      where.date = {
        gte: start,
        lte: end,
      };
    }

    const transactions = await prisma.balanceTransaction.findMany({
      where,
      include: {
        bankAccount: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return transactions;
  }

  /**
   * Create transaction record (called from other services)
   */
  async createTransaction(data: {
    date: Date;
    type: "income" | "expense";
    amount: number;
    paymentType: "cash" | "bank_transfer";
    bankAccountId?: string;
    description?: string;
    source: string;
    sourceId?: string;
    userId: string;
    userName: string;
    beforeBalance?: number;
    afterBalance?: number;
    changeAmount?: number;
  }) {
    const transaction = await prisma.balanceTransaction.create({
      data: {
        date: data.date,
        type: data.type,
        amount: data.amount,
        paymentType: data.paymentType,
        bankAccountId: data.bankAccountId || null,
        description: data.description || null,
        source: data.source,
        sourceId: data.sourceId || null,
        userId: data.userId,
        userName: data.userName,
        beforeBalance: data.beforeBalance !== undefined ? data.beforeBalance : null,
        afterBalance: data.afterBalance !== undefined ? data.afterBalance : null,
        changeAmount: data.changeAmount !== undefined ? data.changeAmount : null,
      },
      include: {
        bankAccount: true,
      },
    });

    return transaction;
  }

  /**
   * Get transaction by ID
   */
  async getTransactionById(id: string) {
    const transaction = await prisma.balanceTransaction.findUnique({
      where: { id },
      include: {
        bankAccount: true,
      },
    });

    return transaction;
  }

  /**
   * Get all transactions grouped by day with daily breaks
   * Includes cash, all banks, and total
   */
  async getAllTransactionsGroupedByDay(startDate?: string, endDate?: string) {
    const where: any = {};

    if (startDate && endDate) {
      // Parse dates properly to avoid timezone issues
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      where.date = {
        gte: start,
        lte: end,
      };
    }

    const transactions = await prisma.balanceTransaction.findMany({
      where,
      include: {
        bankAccount: true,
      },
      orderBy: [
        { date: "asc" },
        { createdAt: "asc" },
      ],
    });

    // Group by date - use local date to avoid timezone issues
    const groupedByDate: Record<string, any[]> = {};
    for (const transaction of transactions) {
      // Get local date components to avoid timezone shifts
      const txDate = new Date(transaction.date);
      const year = txDate.getFullYear();
      const month = String(txDate.getMonth() + 1).padStart(2, '0');
      const day = String(txDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      if (!groupedByDate[dateStr]) {
        groupedByDate[dateStr] = [];
      }
      groupedByDate[dateStr].push(transaction);
    }

    // Calculate daily totals
    const result = Object.entries(groupedByDate).map(([date, dayTransactions]) => {
      let cashIncome = 0;
      let cashExpense = 0;
      const bankTotals: Record<string, { income: number; expense: number }> = {};

      for (const transaction of dayTransactions) {
        const amount = Number(transaction.amount);
        if (transaction.paymentType === "cash") {
          if (transaction.type === "income") {
            cashIncome += amount;
          } else {
            cashExpense += amount;
          }
        } else if (transaction.paymentType === "bank_transfer" && transaction.bankAccountId) {
          if (!bankTotals[transaction.bankAccountId]) {
            bankTotals[transaction.bankAccountId] = { income: 0, expense: 0 };
          }
          if (transaction.type === "income") {
            bankTotals[transaction.bankAccountId].income += amount;
          } else {
            bankTotals[transaction.bankAccountId].expense += amount;
          }
        }
      }

      const cashNet = cashIncome - cashExpense;
      let totalBankIncome = 0;
      let totalBankExpense = 0;
      const bankDetails: Array<{
        bankAccountId: string;
        bankName: string;
        accountNumber: string;
        income: number;
        expense: number;
        net: number;
      }> = [];

      for (const [bankAccountId, totals] of Object.entries(bankTotals)) {
        const transaction = dayTransactions.find(
          (t) => t.bankAccountId === bankAccountId && t.bankAccount
        );
        const bankName = transaction?.bankAccount?.bankName || "Unknown";
        const accountNumber = transaction?.bankAccount?.accountNumber || "";
        const net = totals.income - totals.expense;
        totalBankIncome += totals.income;
        totalBankExpense += totals.expense;
        bankDetails.push({
          bankAccountId,
          bankName,
          accountNumber,
          income: totals.income,
          expense: totals.expense,
          net,
        });
      }

      const totalIncome = cashIncome + totalBankIncome;
      const totalExpense = cashExpense + totalBankExpense;
      const totalNet = totalIncome - totalExpense;

      return {
        date,
        cash: {
          income: cashIncome,
          expense: cashExpense,
          net: cashNet,
        },
        banks: bankDetails,
        total: {
          income: totalIncome,
          expense: totalExpense,
          net: totalNet,
        },
        transactions: dayTransactions,
      };
    });

    return result;
  }
}

export default new BalanceTransactionService();

