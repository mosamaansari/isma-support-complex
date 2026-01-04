import prisma from "../config/database";
import logger from "../utils/logger";
import balanceTransactionService from "./balanceTransaction.service";
import { formatLocalYMD, parseLocalYMD } from "../utils/date";

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
    const dateStr = formatLocalYMD(date);
    // Parse date string to get components
    const [year, month, day] = dateStr.split("-").map(v => parseInt(v, 10));
    
    // Create date at noon (12:00:00) to avoid timezone conversion issues
    // When Prisma stores as DATE type, it extracts the date part
    // Using noon ensures that even if converted to UTC, the date part remains correct
    // Pakistan is UTC+5, so 12:00 PKT = 07:00 UTC (same date)
    const dateObj = new Date(year, month - 1, day, 12, 0, 0, 0);

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
      // Use noon (12:00:00) for date comparison to avoid timezone conversion issues
      const previousDate = new Date(dateObj);
      previousDate.setDate(previousDate.getDate() - 1);
      previousDate.setHours(12, 0, 0, 0); // Set to noon for consistent comparison
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

    logger.info(`Calculating closing balance for ${dateStr}: startingCash=${startingCash}, transactions=${transactions.length}`);

    // Calculate closing balances starting from the determined baseline
    let closingCash = startingCash;
    const closingBankBalances: Record<string, number> = { ...startingBankBalances };

    const closingCardBalances: Record<string, number> = { ...startingCardBalances };

    // Get opening balance creation time to determine which additions to skip
    const openingBalanceCreatedAt = openingBalance?.createdAt 
      ? new Date(openingBalance.createdAt).getTime() 
      : null;
    
    logger.info(`Opening balance exists: ${!!openingBalance}, createdAt: ${openingBalanceCreatedAt ? new Date(openingBalanceCreatedAt).toISOString() : 'N/A'}`);

    // Process balance transactions
    let skippedCount = 0;
    let processedCount = 0;
    for (const transaction of transactions) {
      // IMPORTANT: Filter transactions by actual date to ensure only transactions for the selected date are included
      const txDate = transaction.date ? new Date(transaction.date) : new Date(transaction.createdAt);
      const txYear = txDate.getFullYear();
      const txMonth = txDate.getMonth();
      const txDay = txDate.getDate();
      const txDateOnly = new Date(txYear, txMonth, txDay);
      
      const targetYear = dateObj.getFullYear();
      const targetMonth = dateObj.getMonth();
      const targetDay = dateObj.getDate();
      const targetDateOnly = new Date(targetYear, targetMonth, targetDay);
      
      // Skip transactions that don't match the target date
      if (txDateOnly.getTime() !== targetDateOnly.getTime()) {
        logger.info(`Skipping transaction ${transaction.id} - date mismatch in closing balance: txDate=${txYear}-${String(txMonth + 1).padStart(2, '0')}-${String(txDay).padStart(2, '0')}, targetDate=${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`);
        continue;
      }

      // IMPORTANT: Skip 'opening_balance' transactions if we are starting from today's opening balance record,
      // to avoid double counting. These transactions represent the initial baseline setting.
      if (openingBalance && transaction.source === "opening_balance") {
        skippedCount++;
        logger.info(`Skipping opening_balance transaction: ${transaction.id}, amount=${transaction.amount}`);
        continue;
      }

      // For 'add_opening_balance' transactions: Only skip if they happened BEFORE or AT THE SAME TIME
      // as the opening balance was created. If they happened AFTER, they are real additions during the day.
      if (openingBalance && (
        transaction.source === "add_opening_balance" ||
        (transaction.source && transaction.source.includes("opening_balance") && transaction.source !== "opening_balance")
      )) {
        const txCreatedAt = new Date(transaction.createdAt || transaction.date).getTime();
        // If opening balance exists and this transaction was created before/at opening balance creation,
        // skip it (it's already included in opening balance)
        if (openingBalanceCreatedAt !== null && txCreatedAt <= openingBalanceCreatedAt) {
          skippedCount++;
          logger.info(`Skipping add_opening_balance transaction (before opening balance): ${transaction.id}, amount=${transaction.amount}, txCreated=${new Date(txCreatedAt).toISOString()}, openingBalanceCreated=${new Date(openingBalanceCreatedAt).toISOString()}`);
          continue;
        }
        // Otherwise, include it (it's a real addition during the day)
        logger.info(`Including add_opening_balance transaction (after opening balance): ${transaction.id}, amount=${transaction.amount}, txCreated=${new Date(txCreatedAt).toISOString()}, openingBalanceCreated=${new Date(openingBalanceCreatedAt!).toISOString()}`);
      }

      processedCount++;
      const amount = Number(transaction.amount || 0);
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
      } else if (transaction.paymentType === "card" && transaction.bankAccountId) {
        // We reuse bankAccountId for cardId in balance transactions
        const cardId = transaction.bankAccountId;
        if (!closingCardBalances[cardId]) {
          closingCardBalances[cardId] = 0;
        }
        if (transaction.type === "income") {
          closingCardBalances[cardId] += amount;
        } else {
          closingCardBalances[cardId] -= amount;
        }
      }
    }

    logger.info(`Closing balance calculation: processed=${processedCount}, skipped=${skippedCount}, finalCash=${closingCash}, finalBankTotal=${Object.values(closingBankBalances).reduce((sum, b) => sum + b, 0)}`);

    // Convert to array format
    const bankBalancesArray: BankBalance[] = Object.entries(closingBankBalances)
      .map(([bankAccountId, balance]) => ({
        bankAccountId,
        balance: Number(balance),
      }));

    const cardBalancesArray: CardBalance[] = (Object.entries(closingCardBalances) as [string, number][])
      .map(([cardId, balance]) => ({
        cardId,
        balance: Number(balance),
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
    const dateObj = parseLocalYMD(date);

    const closingBalance = await prisma.dailyClosingBalance.findUnique({
      where: { date: dateObj },
    });

    if (closingBalance) {
      // Calculate card balances on-the-fly
      const cardBalances = await this.calculateCardBalancesForDate(dateObj);

      return {
        date: formatLocalYMD(closingBalance.date),
        cashBalance: Number(closingBalance.cashBalance),
        bankBalances: (closingBalance.bankBalances as any[]) || [],
        cardBalances: cardBalances,
      };
    }

    // If not found, calculate it
    const calculated = await this.calculateAndStoreClosingBalance(dateObj);
    const cardBalances = await this.calculateCardBalancesForDate(dateObj);

    return {
      date: formatLocalYMD(calculated.date),
      cashBalance: Number(calculated.cashBalance),
      bankBalances: (calculated.bankBalances as any[]) || [],
      cardBalances: cardBalances,
    };
  }

  /**
   * Calculate card balances for a specific date
   */
  private async calculateCardBalancesForDate(dateObj: Date): Promise<CardBalance[]> {
    const dateStr = formatLocalYMD(dateObj);
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
      // Use noon (12:00:00) for date comparison to avoid timezone conversion issues
      const previousDate = new Date(dateObj);
      previousDate.setDate(previousDate.getDate() - 1);
      previousDate.setHours(12, 0, 0, 0); // Set to noon for consistent comparison
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
          const paymentDateStr = formatLocalYMD(paymentDate);
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
          const paymentDateStr = formatLocalYMD(paymentDate);
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
    // Parse date string to get components
    const [year, month, day] = date.split("-").map(v => parseInt(v, 10));
    
    // Create date at noon (12:00:00) to avoid timezone conversion issues
    const dateObj = new Date(year, month - 1, day, 12, 0, 0, 0);
    dateObj.setDate(dateObj.getDate() - 1); // Get previous day

    const previousClosing = await prisma.dailyClosingBalance.findUnique({
      where: { date: dateObj },
    });

    if (previousClosing) {
      return {
        date: formatLocalYMD(previousClosing.date),
        cashBalance: Number(previousClosing.cashBalance),
        bankBalances: (previousClosing.bankBalances as any[]) || [],
        cardBalances: (previousClosing.cardBalances as any[]) || [],
      };
    }

    // If not found, calculate it
    // dateObj is already at noon, so we can use it directly
    return await this.calculateAndStoreClosingBalance(dateObj);
  }

  /**
   * Get closing balances for a date range
   */
  async getClosingBalances(startDate: string, endDate: string) {
    // Parse date strings to get components and create at noon (12:00:00)
    const [startYear, startMonth, startDay] = startDate.split("-").map(v => parseInt(v, 10));
    const [endYear, endMonth, endDay] = endDate.split("-").map(v => parseInt(v, 10));
    const start = new Date(startYear, startMonth - 1, startDay, 12, 0, 0, 0);
    const end = new Date(endYear, endMonth - 1, endDay, 12, 59, 59, 999);

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
      date: formatLocalYMD(cb.date),
      cashBalance: Number(cb.cashBalance),
      bankBalances: (cb.bankBalances as any[]) || [],
    }));
  }
}

export default new DailyClosingBalanceService();

