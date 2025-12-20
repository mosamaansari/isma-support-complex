import prisma from "../config/database";
import logger from "../utils/logger";
import balanceTransactionService from "./balanceTransaction.service";

interface BankBalance {
  bankAccountId: string;
  balance: number;
}

interface CardBalance {
  cardId: string;
  balance: number;
}

class DailyClosingBalanceService {
  /**
   * Calculate and store closing balance for a specific date
   */
  async calculateAndStoreClosingBalance(date: Date) {
    const dateStr = date.toISOString().split('T')[0];
    const dateObj = new Date(dateStr);
    dateObj.setHours(0, 0, 0, 0);

    // Get opening balance for this date
    const openingBalance = await prisma.dailyOpeningBalance.findUnique({
      where: { date: dateObj },
    });

    let startingCash = 0;
    const startingBankBalances: Record<string, number> = {};
    const startingCardBalances: Record<string, number> = {};

    if (openingBalance) {
      startingCash = Number(openingBalance.cashBalance) || 0;
      const bankBalances = (openingBalance.bankBalances as any[]) || [];
      for (const bankBalance of bankBalances) {
        if (bankBalance.bankAccountId) {
          startingBankBalances[bankBalance.bankAccountId] = Number(bankBalance.balance) || 0;
        }
      }
      // Get card balances from opening balance
      const cardBalances = (openingBalance.cardBalances as any[]) || [];
      for (const cardBalance of cardBalances) {
        if (cardBalance.cardId) {
          startingCardBalances[cardBalance.cardId] = Number(cardBalance.balance) || 0;
        }
      }
    } else {
      // If no opening balance, get previous day's closing balance
      const previousDate = new Date(dateObj);
      previousDate.setDate(previousDate.getDate() - 1);
      const previousClosing = await prisma.dailyClosingBalance.findUnique({
        where: { date: previousDate },
      });
      if (previousClosing) {
        startingCash = Number(previousClosing.cashBalance) || 0;
        const bankBalances = (previousClosing.bankBalances as any[]) || [];
        for (const bankBalance of bankBalances) {
          if (bankBalance.bankAccountId) {
            startingBankBalances[bankBalance.bankAccountId] = Number(bankBalance.balance) || 0;
          }
        }
        // Get card balances from previous closing (if stored)
        const cardBalances = (previousClosing.cardBalances as any[]) || [];
        for (const cardBalance of cardBalances) {
          if (cardBalance.cardId) {
            startingCardBalances[cardBalance.cardId] = Number(cardBalance.balance) || 0;
          }
        }
      }
    }

    // Get all transactions for this date
    const transactions = await balanceTransactionService.getTransactions({
      startDate: dateStr,
      endDate: dateStr,
    });

    // Calculate closing balances
    let closingCash = startingCash;
    const closingBankBalances: Record<string, number> = { ...startingBankBalances };
    const closingCardBalances: Record<string, number> = { ...startingCardBalances };

    // Process balance transactions
    for (const transaction of transactions) {
      const amount = Number(transaction.amount);
      if (transaction.paymentType === "cash") {
        if (transaction.type === "income") {
          closingCash += amount;
        } else {
          closingCash -= amount;
        }
      } else if (transaction.paymentType === "bank_transfer" && transaction.bankAccountId) {
        if (!closingBankBalances[transaction.bankAccountId]) {
          closingBankBalances[transaction.bankAccountId] = 0;
        }
        if (transaction.type === "income") {
          closingBankBalances[transaction.bankAccountId] += amount;
        } else {
          closingBankBalances[transaction.bankAccountId] -= amount;
        }
      }
    }

    // Calculate card balances from sales, purchases, and expenses
    // Get sales with card payments for this date
    const sales = await prisma.sale.findMany({
      where: {
        date: {
          gte: dateObj,
          lt: new Date(dateObj.getTime() + 24 * 60 * 60 * 1000), // Next day
        },
        status: "completed",
      },
      select: {
        payments: true,
      },
    });

    // Get purchases with card payments for this date
    const purchases = await prisma.purchase.findMany({
      where: {
        date: {
          gte: dateObj,
          lt: new Date(dateObj.getTime() + 24 * 60 * 60 * 1000), // Next day
        },
        status: "completed",
      },
      select: {
        payments: true,
      },
    });

    // Get expenses with card payments for this date
    const expenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: dateObj,
          lt: new Date(dateObj.getTime() + 24 * 60 * 60 * 1000), // Next day
        },
      },
      select: {
        paymentType: true,
        amount: true,
        cardId: true,
      },
    });

    // Process sales card payments
    for (const sale of sales) {
      const payments = (sale.payments as Array<{ type: string; amount: number; cardId?: string; date?: string }> | null) || [];
      for (const payment of payments) {
        if (payment.type === "card" && payment.cardId) {
          const paymentDate = payment.date ? new Date(payment.date) : dateObj;
          const paymentDateStr = paymentDate.toISOString().split('T')[0];
          if (paymentDateStr === dateStr) {
            const amount = Number(payment.amount || 0);
            if (!closingCardBalances[payment.cardId]) {
              closingCardBalances[payment.cardId] = 0;
            }
            closingCardBalances[payment.cardId] += amount; // Card payments are income
          }
        }
      }
    }

    // Process purchase card payments
    for (const purchase of purchases) {
      const payments = (purchase.payments as Array<{ type: string; amount: number; cardId?: string; date?: string }> | null) || [];
      for (const payment of payments) {
        if (payment.type === "card" && payment.cardId) {
          const paymentDate = payment.date ? new Date(payment.date) : dateObj;
          const paymentDateStr = paymentDate.toISOString().split('T')[0];
          if (paymentDateStr === dateStr) {
            const amount = Number(payment.amount || 0);
            if (!closingCardBalances[payment.cardId]) {
              closingCardBalances[payment.cardId] = 0;
            }
            closingCardBalances[payment.cardId] -= amount; // Purchase card payments are expense
          }
        }
      }
    }

    // Process expense card payments (if cardId exists, it's a card payment)
    for (const expense of expenses) {
      if (expense.cardId) {
        const amount = Number(expense.amount || 0);
        if (!closingCardBalances[expense.cardId]) {
          closingCardBalances[expense.cardId] = 0;
        }
        closingCardBalances[expense.cardId] -= amount; // Expenses are deductions
      }
    }

    // Convert to array format
    const bankBalancesArray: BankBalance[] = Object.entries(closingBankBalances)
      .filter(([_, balance]) => balance > 0)
      .map(([bankAccountId, balance]) => ({
        bankAccountId,
        balance,
      }));

    const cardBalancesArray: CardBalance[] = Object.entries(closingCardBalances)
      .filter(([_, balance]) => balance > 0)
      .map(([cardId, balance]) => ({
        cardId,
        balance,
      }));

    // Store closing balance
    const closingBalanceData: any = {
      cashBalance: closingCash,
      bankBalances: bankBalancesArray as any,
      cardBalances: cardBalancesArray as any,
    };

    const closingBalance = await prisma.dailyClosingBalance.upsert({
      where: { date: dateObj },
      update: closingBalanceData,
      create: {
        date: dateObj,
        ...closingBalanceData,
      },
    });

    // Create balance transaction for closing balance (for tracking purposes)
    try {
      const balanceTransactionService = (await import("./balanceTransaction.service")).default;
      // Note: We don't create a transaction for closing balance itself as it's calculated
      // But we can create a summary transaction if needed
      // For now, closing balance is just stored, transactions are already created from sales/purchases/expenses
    } catch (error) {
      logger.error("Error creating closing balance transaction:", error);
      // Don't fail if transaction creation fails
    }

    return closingBalance;
  }

  /**
   * Get closing balance for a specific date
   */
  async getClosingBalance(date: string) {
    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);

    const closingBalance = await prisma.dailyClosingBalance.findUnique({
      where: { date: dateObj },
    });

    if (closingBalance) {
      // Calculate card balances on-the-fly
      const cardBalances = await this.calculateCardBalancesForDate(dateObj);
      
      return {
        date: closingBalance.date.toISOString().split('T')[0],
        cashBalance: Number(closingBalance.cashBalance),
        bankBalances: (closingBalance.bankBalances as any[]) || [],
        cardBalances: cardBalances,
      };
    }

    // If not found, calculate it
    const calculated = await this.calculateAndStoreClosingBalance(dateObj);
    const cardBalances = await this.calculateCardBalancesForDate(dateObj);
    
    return {
      date: calculated.date.toISOString().split('T')[0],
      cashBalance: Number(calculated.cashBalance),
      bankBalances: (calculated.bankBalances as any[]) || [],
      cardBalances: cardBalances,
    };
  }

  /**
   * Calculate card balances for a specific date
   */
  private async calculateCardBalancesForDate(dateObj: Date): Promise<CardBalance[]> {
    const dateStr = dateObj.toISOString().split('T')[0];
    const cardBalances: Record<string, number> = {};

    // Get opening balance card balances
    const openingBalance = await prisma.dailyOpeningBalance.findUnique({
      where: { date: dateObj },
    });

    if (openingBalance && openingBalance.cardBalances) {
      const openingCardBalances = (openingBalance.cardBalances as any[]) || [];
      for (const cardBalance of openingCardBalances) {
        if (cardBalance.cardId) {
          cardBalances[cardBalance.cardId] = Number(cardBalance.balance) || 0;
        }
      }
    } else {
      // Get from previous day's closing
      const previousDate = new Date(dateObj);
      previousDate.setDate(previousDate.getDate() - 1);
      const previousClosing = await prisma.dailyClosingBalance.findUnique({
        where: { date: previousDate },
      });
      if (previousClosing && (previousClosing as any).cardBalances) {
        const prevCardBalances = ((previousClosing as any).cardBalances as any[]) || [];
        for (const cardBalance of prevCardBalances) {
          if (cardBalance.cardId) {
            cardBalances[cardBalance.cardId] = Number(cardBalance.balance) || 0;
          }
        }
      }
    }

    // Get sales, purchases, expenses with card payments
    const sales = await prisma.sale.findMany({
      where: {
        date: {
          gte: dateObj,
          lt: new Date(dateObj.getTime() + 24 * 60 * 60 * 1000),
        },
        status: "completed",
      },
      select: { payments: true },
    });

    const purchases = await prisma.purchase.findMany({
      where: {
        date: {
          gte: dateObj,
          lt: new Date(dateObj.getTime() + 24 * 60 * 60 * 1000),
        },
        status: "completed",
      },
      select: { payments: true },
    });

    const expenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: dateObj,
          lt: new Date(dateObj.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      select: { paymentType: true, amount: true, cardId: true },
    });

    // Process card payments
    for (const sale of sales) {
      const payments = (sale.payments as Array<{ type: string; amount: number; cardId?: string; date?: string }> | null) || [];
      for (const payment of payments) {
        if (payment.type === "card" && payment.cardId) {
          const paymentDate = payment.date ? new Date(payment.date) : dateObj;
          const paymentDateStr = paymentDate.toISOString().split('T')[0];
          if (paymentDateStr === dateStr) {
            const amount = Number(payment.amount || 0);
            if (!cardBalances[payment.cardId]) cardBalances[payment.cardId] = 0;
            cardBalances[payment.cardId] += amount;
          }
        }
      }
    }

    for (const purchase of purchases) {
      const payments = (purchase.payments as Array<{ type: string; amount: number; cardId?: string; date?: string }> | null) || [];
      for (const payment of payments) {
        if (payment.type === "card" && payment.cardId) {
          const paymentDate = payment.date ? new Date(payment.date) : dateObj;
          const paymentDateStr = paymentDate.toISOString().split('T')[0];
          if (paymentDateStr === dateStr) {
            const amount = Number(payment.amount || 0);
            if (!cardBalances[payment.cardId]) cardBalances[payment.cardId] = 0;
            cardBalances[payment.cardId] -= amount;
          }
        }
      }
    }

    for (const expense of expenses) {
      if (expense.cardId) {
        const amount = Number(expense.amount || 0);
        if (!cardBalances[expense.cardId]) cardBalances[expense.cardId] = 0;
        cardBalances[expense.cardId] -= amount;
      }
    }

    return Object.entries(cardBalances)
      .filter(([_, balance]) => balance > 0)
      .map(([cardId, balance]) => ({ cardId, balance }));
  }

  /**
   * Get previous day's closing balance (which becomes next day's opening balance)
   */
  async getPreviousDayClosingBalance(date: string) {
    const dateObj = new Date(date);
    dateObj.setHours(0, 0, 0, 0);
    dateObj.setDate(dateObj.getDate() - 1);

    const previousClosing = await prisma.dailyClosingBalance.findUnique({
      where: { date: dateObj },
    });

    if (previousClosing) {
      return {
        date: previousClosing.date.toISOString().split('T')[0],
        cashBalance: Number(previousClosing.cashBalance),
        bankBalances: (previousClosing.bankBalances as any[]) || [],
        cardBalances: (previousClosing.cardBalances as any[]) || [],
      };
    }

    // If not found, calculate it
    return await this.calculateAndStoreClosingBalance(dateObj);
  }

  /**
   * Get closing balances for a date range
   */
  async getClosingBalances(startDate: string, endDate: string) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const closingBalances = await prisma.dailyClosingBalance.findMany({
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { date: "asc" },
    });

    return closingBalances.map((cb) => ({
      date: cb.date.toISOString().split('T')[0],
      cashBalance: Number(cb.cashBalance),
      bankBalances: (cb.bankBalances as any[]) || [],
    }));
  }
}

export default new DailyClosingBalanceService();

