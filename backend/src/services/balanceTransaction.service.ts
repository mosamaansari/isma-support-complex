import prisma from "../config/database";
import logger from "../utils/logger";

interface TransactionFilters {
  startDate?: string;
  endDate?: string;
  paymentType?: "cash" | "bank_transfer" | "card";
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
      // Parse date strings (YYYY-MM-DD) properly using local timezone (Pakistan)
      const startParts = filters.startDate.split("-");
      const endParts = filters.endDate.split("-");
      
      if (startParts.length === 3 && endParts.length === 3) {
        // Create dates in local timezone (Pakistan) to match how dates are stored
        const startYear = parseInt(startParts[0]);
        const startMonth = parseInt(startParts[1]) - 1; // Month is 0-indexed
        const startDay = parseInt(startParts[2]);
        
        const endYear = parseInt(endParts[0]);
        const endMonth = parseInt(endParts[1]) - 1; // Month is 0-indexed
        const endDay = parseInt(endParts[2]);

        // Create start and end dates using local date components (Pakistan timezone)
        const start = new Date(startYear, startMonth, startDay, 0, 0, 0, 0);
        const end = new Date(endYear, endMonth, endDay, 23, 59, 59, 999);

        // For sales, purchases, expenses, and refunds, also check createdAt to ensure they're included if they occurred in the date range
        // This handles cases where date field might not match the actual transaction date
        // Use OR to include transactions where either:
        // 1. date field is in range (for regular transactions with correct date)
        // 2. createdAt is in range AND source is sale/purchase/expense/refund (for transactions where date might be wrong)
        where.OR = [
          // All transactions where date field is in range
          {
            date: {
              gte: start,
              lte: end,
            },
          },
          // Sales, purchases, expenses, refunds, and opening balance additions where createdAt is in range (even if date field is outside range)
          {
            createdAt: {
              gte: start,
              lte: end,
            },
            source: {
              in: ["sale", "sale_payment", "purchase", "purchase_payment", "expense", "sale_refund", "purchase_refund", "add_opening_balance"],
            },
          },
        ];
      } else {
        // Fallback to old method if date format is invalid
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);

        where.date = {
          gte: start,
          lte: end,
        };
      }
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
  async getCashTransactions(startDate?: string, endDate?: string, excludeRefunds: boolean = false) {
    const where: any = {};

    // Build date filter conditions
    let dateFilter: any = null;
    if (startDate && endDate) {
      // Parse date strings (YYYY-MM-DD) properly using local timezone (Pakistan)
      const startParts = startDate.split("-");
      const endParts = endDate.split("-");
      
      if (startParts.length === 3 && endParts.length === 3) {
        // Create dates in local timezone (Pakistan) to match how dates are stored
        const startYear = parseInt(startParts[0]);
        const startMonth = parseInt(startParts[1]) - 1; // Month is 0-indexed
        const startDay = parseInt(startParts[2]);
        
        const endYear = parseInt(endParts[0]);
        const endMonth = parseInt(endParts[1]) - 1; // Month is 0-indexed
        const endDay = parseInt(endParts[2]);

        // Create start and end dates using local date components (Pakistan timezone)
        const start = new Date(startYear, startMonth, startDay, 0, 0, 0, 0);
        const end = new Date(endYear, endMonth, endDay, 23, 59, 59, 999);

        // For sales, purchases, and refunds, check both date and createdAt to ensure they're included
        // This handles cases where date field might not match due to timezone or other issues
        // Use OR to include transactions where either date OR createdAt is in range
        dateFilter = {
          OR: [
            // All transactions where date field is in range
            {
              date: {
                gte: start,
                lte: end,
              },
            },
            // Sales, purchases, and refunds where createdAt is in range (even if date field is outside range)
            // This ensures these transactions are included based on when they actually occurred
            {
              createdAt: {
                gte: start,
                lte: end,
              },
              source: {
                in: ["sale", "sale_payment", "purchase", "purchase_payment", "sale_refund", "purchase_refund"],
              },
            },
          ],
        };
      } else {
        // Fallback to old method if date format is invalid
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        dateFilter = {
          date: {
            gte: start,
            lte: end,
          },
        };
      }
    }

    // Build the where clause with AND conditions
    where.paymentType = "cash";

    // Add date filter if provided
    if (dateFilter) {
      // If we have date filter, we need to use AND to combine with paymentType
      const andConditions: any[] = [
        { paymentType: "cash" },
        dateFilter,
      ];

      // Exclude refund transactions if requested (for opening balance)
      if (excludeRefunds) {
        andConditions.push({
          source: {
            not: {
              in: ["sale_refund", "purchase_refund"],
            },
          },
        });
      }

      where.AND = andConditions;
    } else {
      // No date filter, just add excludeRefunds if needed
      if (excludeRefunds) {
        where.source = {
          not: {
            in: ["sale_refund", "purchase_refund"],
          },
        };
      }
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
  async getBankTransactions(bankAccountId: string, startDate?: string, endDate?: string, excludeRefunds: boolean = false) {
    const where: any = {
      paymentType: "bank_transfer",
      bankAccountId,
    };

    // Exclude refund transactions if requested (for opening balance)
    if (excludeRefunds) {
      where.source = {
        not: {
          in: ["sale_refund", "purchase_refund"],
        },
      };
    }

    if (startDate && endDate) {
      // Parse date strings (YYYY-MM-DD) properly using local timezone (Pakistan)
      const startParts = startDate.split("-");
      const endParts = endDate.split("-");
      
      if (startParts.length === 3 && endParts.length === 3) {
        // Create dates in local timezone (Pakistan) to match how dates are stored
        const startYear = parseInt(startParts[0]);
        const startMonth = parseInt(startParts[1]) - 1; // Month is 0-indexed
        const startDay = parseInt(startParts[2]);
        
        const endYear = parseInt(endParts[0]);
        const endMonth = parseInt(endParts[1]) - 1; // Month is 0-indexed
        const endDay = parseInt(endParts[2]);

        // Create start and end dates using local date components (Pakistan timezone)
        const start = new Date(startYear, startMonth, startDay, 0, 0, 0, 0);
        const end = new Date(endYear, endMonth, endDay, 23, 59, 59, 999);

        // For refunds, also check createdAt to ensure they're included if they occurred in the date range
        // Use OR to include transactions where either date OR createdAt (for refunds) is in range
        // Note: paymentType: "bank_transfer" and bankAccountId are already set at top level
        where.OR = [
          // All bank transactions where date field is in range
          {
            date: {
              gte: start,
              lte: end,
            },
            paymentType: "bank_transfer", // Explicitly include paymentType in OR branch
            bankAccountId, // Explicitly include bankAccountId in OR branch
          },
          // Bank refunds where createdAt is in range (even if date field is outside range)
          {
            createdAt: {
              gte: start,
              lte: end,
            },
            source: {
              in: ["sale_refund", "purchase_refund"],
            },
            paymentType: "bank_transfer", // Explicitly include paymentType in OR branch
            bankAccountId, // Explicitly include bankAccountId in OR branch
          },
        ];
      } else {
        // Fallback to old method if date format is invalid
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        where.date = {
          gte: start,
          lte: end,
        };
      }
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
    paymentType: "cash" | "bank_transfer" | "card";
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
  async getAllTransactionsGroupedByDay(startDate?: string, endDate?: string, excludeRefunds: boolean = false) {
    const where: any = {};

    if (startDate && endDate) {
      const [sy, sm, sd] = startDate.split("-").map((v) => parseInt(v, 10));
      const [ey, em, ed] = endDate.split("-").map((v) => parseInt(v, 10));
      const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
      const endPlus1 = new Date(ey, em - 1, ed + 1, 23, 59, 59, 999);

      // Build OR conditions for date filtering
      const orConditions: any[] = [
        // All transactions where date field is in range
        {
          date: { gte: start, lte: endPlus1 },
        },
        // Payments, refunds, and opening balance additions where createdAt is in range (even if date field is outside range)
        {
          createdAt: { gte: start, lte: endPlus1 },
          source: {
            in: ["sale_payment", "purchase_payment", "sale_refund", "purchase_refund", "add_opening_balance", "expense"],
          },
        },
      ];

      // If excludeRefunds is true, add condition to exclude refunds
      if (excludeRefunds) {
        where.AND = [
          {
            OR: orConditions,
          },
          {
            source: {
              not: {
                in: ["sale_refund", "purchase_refund"],
              },
            },
          },
        ];
      } else {
        where.OR = orConditions;
      }
    } else {
      // No date filter, but still exclude refunds if requested
      if (excludeRefunds) {
        where.source = {
          not: {
            in: ["sale_refund", "purchase_refund"],
          },
        };
      }
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

    logger.info(`getAllTransactionsGroupedByDay: Found ${transactions.length} transactions for date range ${startDate} to ${endDate}, excludeRefunds=${excludeRefunds}`);
    if (transactions.length > 0) {
      logger.info(`Sample transaction: id=${transactions[0].id}, source=${transactions[0].source}, date=${transactions[0].date}, createdAt=${transactions[0].createdAt}, paymentType=${transactions[0].paymentType}`);
    }

    // Group by createdAt's local date (when the txn actually occurred) to match closing balance logic
    // IMPORTANT: For 'add_opening_balance' transactions, also check the 'date' field
    // because these manual additions should be grouped by their intended date, not just when they were created
    const groupedByDate: Record<string, any[]> = {};
    for (const transaction of transactions) {
      // For add_opening_balance transactions, prefer date field over createdAt
      // For sale_payment and purchase_payment, also check date field if available
      let txDate: Date;
      if (transaction.source === "add_opening_balance" || 
          (transaction.source && transaction.source.includes("opening_balance") && transaction.source !== "opening_balance")) {
        // Use date field if available, otherwise use createdAt
        txDate = transaction.date ? new Date(transaction.date) : new Date(transaction.createdAt);
      } else if (transaction.source === "sale_payment" || transaction.source === "purchase_payment") {
        // For payments, prefer date field if it exists and is valid, otherwise use createdAt
        if (transaction.date) {
          const dateFromField = new Date(transaction.date);
          // Check if date field is valid (not invalid date)
          if (!isNaN(dateFromField.getTime())) {
            txDate = dateFromField;
          } else {
            txDate = new Date(transaction.createdAt);
          }
        } else {
          txDate = new Date(transaction.createdAt);
        }
      } else {
        // For other transactions, use createdAt
        txDate = new Date(transaction.createdAt);
      }
      
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
    let entries = (startDate && endDate)
      ? Object.entries(groupedByDate).filter(([d]) => d >= startDate && d <= endDate)
      : Object.entries(groupedByDate);
    entries = entries.sort((a, b) => a[0].localeCompare(b[0]));

    const result = entries.map(([date, dayTransactions]) => {
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
        } else if (transaction.paymentType === "card" && transaction.bankAccountId) {
          // Card transactions - treat bankAccountId as cardId for cards
          const cardId = transaction.bankAccountId;
          if (!bankTotals[cardId]) {
            bankTotals[cardId] = { income: 0, expense: 0 };
          }
          if (transaction.type === "income") {
            bankTotals[cardId].income += amount;
          } else {
            bankTotals[cardId].expense += amount;
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

