import prisma from "../config/database";
import logger from "../utils/logger";
import balanceTransactionService from "./balanceTransaction.service";
import { formatLocalYMD, parseLocalYMD, parseLocalYMDForDB } from "../utils/date";

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

    // Check if closing balance already exists - don't overwrite if it exists
    const existingClosing = await prisma.dailyClosingBalance.findUnique({
      where: { date: dateObj },
    });
    
    if (existingClosing) {
      logger.info(`Closing balance already exists for ${dateStr}, skipping calculation to preserve existing data. Cash: ${existingClosing.cashBalance}, Banks: ${(existingClosing.bankBalances as any[])?.length || 0}, Cards: ${(existingClosing.cardBalances as any[])?.length || 0}`);
      return existingClosing;
    }

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

    // Get transactions for this date and the next day (to include txns with date=next day but created late night in local time)
    const nextDay = new Date(year, month - 1, day + 1);
    const nextDayStr = formatLocalYMD(nextDay);
    const transactionsRaw = await balanceTransactionService.getTransactions({
      startDate: dateStr,
      endDate: nextDayStr,
    });

    // Filter by createdAt's LOCAL date so txns are assigned to the day they actually occurred
    // IMPORTANT: For 'add_opening_balance' transactions, also check the 'date' field
    // because these manual additions should be included based on their intended date,
    // not just when they were created (which might be at a different time)
    const transactions = transactionsRaw.filter((tx: any) => {
      // Check createdAt's local date (for most transactions)
      const txCreated = new Date(tx.createdAt);
      const ty = txCreated.getFullYear(), tm = txCreated.getMonth(), td = txCreated.getDate();
      const matchesCreatedAt = ty === year && tm === month - 1 && td === day;
      
      // For add_opening_balance transactions, also check the date field
      // This ensures manual cash additions are included even if created at a different time
      if (tx.source === "add_opening_balance" || 
          (tx.source && tx.source.includes("opening_balance") && tx.source !== "opening_balance")) {
        const txDate = new Date(tx.date);
        const txYear = txDate.getFullYear();
        const txMonth = txDate.getMonth();
        const txDay = txDate.getDate();
        const matchesDateField = txYear === year && txMonth === month - 1 && txDay === day;
        
        // Include if either createdAt or date field matches
        return matchesCreatedAt || matchesDateField;
      }
      
      // For other transactions, use createdAt only
      return matchesCreatedAt;
    });

    // Log bank balances from starting balance
    const startingBankList = Object.entries(startingBankBalances).map(([id, bal]) => `${id}:${bal}`).join(', ');
    logger.info(`Calculating closing balance for ${dateStr}: startingCash=${startingCash}, startingBanks=[${startingBankList}], transactions=${transactions.length} (raw=${transactionsRaw.length})`);
    
    // Log add_opening_balance transactions for debugging
    const addOpeningBalanceTxns = transactions.filter((tx: any) => 
      tx.source === "add_opening_balance" || 
      (tx.source && tx.source.includes("opening_balance") && tx.source !== "opening_balance")
    );
    if (addOpeningBalanceTxns.length > 0) {
      logger.info(`Found ${addOpeningBalanceTxns.length} add_opening_balance transactions:`, 
        addOpeningBalanceTxns.map((tx: any) => ({
          id: tx.id,
          paymentType: tx.paymentType,
          bankAccountId: tx.bankAccountId,
          amount: tx.amount,
          type: tx.type,
          date: tx.date,
          createdAt: tx.createdAt
        }))
      );
    }

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
      // (Transactions are already filtered by createdAt's local date above)

      // IMPORTANT: Skip 'opening_balance' transactions if we are starting from today's opening balance record,
      // to avoid double counting. These transactions represent the initial baseline setting.
      if (openingBalance && transaction.source === "opening_balance") {
        skippedCount++;
        logger.info(`Skipping opening_balance transaction: ${transaction.id}, amount=${transaction.amount}`);
        continue;
      }

      // IMPORTANT: ALWAYS include 'add_opening_balance' transactions in closing balance calculation
      // When user manually adds to opening balance, it should always be reflected in closing balance
      // This ensures that:
      // - Cash additions are summed in cash
      // - Bank additions are summed in respective banks (or new banks are added to bank JSON)
      // - Card additions are summed in respective cards
      if (transaction.source === "add_opening_balance" ||
          (transaction.source && transaction.source.includes("opening_balance") && transaction.source !== "opening_balance")) {
        logger.info(`Including add_opening_balance transaction: ${transaction.id}, amount=${transaction.amount}, paymentType=${transaction.paymentType}, bankAccountId=${transaction.bankAccountId}`);
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
        // Initialize bank balance to 0 if it doesn't exist (for new banks)
        const beforeBankBalance = closingBankBalances[transaction.bankAccountId] || 0;
        if (!closingBankBalances[transaction.bankAccountId]) {
          closingBankBalances[transaction.bankAccountId] = 0;
          logger.info(`New bank added to closing balance: ${transaction.bankAccountId}, source: ${transaction.source}`);
        }
        if (transaction.type === "income") {
          closingBankBalances[transaction.bankAccountId] += amount;
          logger.info(`Bank balance updated: ${transaction.bankAccountId}, before: ${beforeBankBalance}, amount: +${amount}, after: ${closingBankBalances[transaction.bankAccountId]}, source: ${transaction.source}`);
        } else {
          closingBankBalances[transaction.bankAccountId] -= amount;
          logger.info(`Bank balance updated: ${transaction.bankAccountId}, before: ${beforeBankBalance}, amount: -${amount}, after: ${closingBankBalances[transaction.bankAccountId]}, source: ${transaction.source}`);
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

    const finalBankList = Object.entries(closingBankBalances).map(([id, bal]) => `${id}:${bal}`).join(', ');
    logger.info(`Closing balance calculation: processed=${processedCount}, skipped=${skippedCount}, finalCash=${closingCash}, finalBanks=[${finalBankList}], finalBankTotal=${Object.values(closingBankBalances).reduce((sum, b) => sum + b, 0)}`);

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

    // Create new closing balance (we already checked it doesn't exist above)
    const closingBalance = await prisma.dailyClosingBalance.create({
      data: {
        date: dateObj,
        ...closingBalanceData,
        createdAt: new Date(), // Explicitly set createdAt to current time for accurate tracking
      },
    });

    const storedBankList = bankBalancesArray.map(b => `${b.bankAccountId}:${b.balance}`).join(', ');
    logger.info(`Closing balance stored for ${dateStr}: cash=${closingCash}, banks=[${storedBankList}], createdAt=${closingBalance.createdAt.toISOString()}, updatedAt=${closingBalance.updatedAt.toISOString()}`);

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
   * Directly add/subtract amount to/from closing balance without recalculating
   * If row doesn't exist, creates it. If exists, adds/subtracts to/from existing balance.
   * For expenses/purchases, pass negative amount or use isExpense=true
   */
  async addToClosingBalance(
    date: Date,
    amount: number,
    type: "cash" | "bank" | "card",
    bankAccountId?: string,
    cardId?: string,
    isExpense: boolean = false
  ) {
    const dateStr = formatLocalYMD(date);
    const [year, month, day] = dateStr.split("-").map(v => parseInt(v, 10));
    const dateObj = new Date(year, month - 1, day, 12, 0, 0, 0);

    // Get existing closing balance or create new one
    let existingClosing = await prisma.dailyClosingBalance.findUnique({
      where: { date: dateObj },
    });

    // Calculate the change amount (negative for expenses)
    const changeAmount = isExpense ? -amount : amount;
    const operation = isExpense ? "subtracted" : "added";

    if (!existingClosing) {
      // Row doesn't exist, create it with the new amount
      // For expenses, we need to get starting balance first (from previous day or opening balance)
      let startingCash = 0;
      const startingBankBalances: Record<string, number> = {};
      const startingCardBalances: Record<string, number> = {};

      // Get opening balance for this date
      const openingBalance = await prisma.dailyOpeningBalance.findUnique({
        where: { date: dateObj },
      });

      if (openingBalance) {
        startingCash = Number(openingBalance.cashBalance) || 0;
        const bankBalances = (openingBalance.bankBalances as any[]) || [];
        for (const bankBalance of bankBalances) {
          if (bankBalance.bankAccountId) {
            startingBankBalances[bankBalance.bankAccountId] = Number(bankBalance.balance) || 0;
          }
        }
        const cardBalances = (openingBalance.cardBalances as any[]) || [];
        for (const cardBalance of cardBalances) {
          if (cardBalance.cardId) {
            startingCardBalances[cardBalance.cardId] = Number(cardBalance.balance) || 0;
          }
        }
      } else {
        // Get previous day's closing balance
        const previousDate = new Date(dateObj);
        previousDate.setDate(previousDate.getDate() - 1);
        previousDate.setHours(12, 0, 0, 0);
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
          const cardBalances = (previousClosing.cardBalances as any[]) || [];
          for (const cardBalance of cardBalances) {
            if (cardBalance.cardId) {
              startingCardBalances[cardBalance.cardId] = Number(cardBalance.balance) || 0;
            }
          }
        }
      }

      // Apply the change
      if (type === "cash") {
        startingCash += changeAmount;
      } else if (type === "bank" && bankAccountId) {
        startingBankBalances[bankAccountId] = (startingBankBalances[bankAccountId] || 0) + changeAmount;
      } else if (type === "card" && cardId) {
        startingCardBalances[cardId] = (startingCardBalances[cardId] || 0) + changeAmount;
      }

      const closingBalanceData: any = {
        date: dateObj,
        cashBalance: Number(startingCash),
        bankBalances: Object.entries(startingBankBalances).map(([id, bal]) => ({ 
          bankAccountId: id, 
          balance: Number(bal) 
        })),
        cardBalances: Object.entries(startingCardBalances).map(([id, bal]) => ({ 
          cardId: id, 
          balance: Number(bal) 
        })),
      };

      const newClosing = await prisma.dailyClosingBalance.create({
        data: closingBalanceData,
      });

      logger.info(`Created new closing balance row for ${dateStr}: ${type} ${amount} ${operation}`);
      return newClosing;
    }

    // Row exists, add/subtract from existing balance
    let updatedCashBalance = Number(existingClosing.cashBalance) || 0;
    const existingBankBalances = (existingClosing.bankBalances as any[]) || [];
    const existingCardBalances = (existingClosing.cardBalances as any[]) || [];

    if (type === "cash") {
      const oldBalance = updatedCashBalance;
      updatedCashBalance = Number(updatedCashBalance) + changeAmount;
      logger.info(`${isExpense ? 'Subtracted' : 'Added'} ${amount} ${isExpense ? 'from' : 'to'} cash in closing balance for ${dateStr}: ${oldBalance} ${isExpense ? '-' : '+'} ${amount} = ${updatedCashBalance}`);
    } else if (type === "bank" && bankAccountId) {
      // Find or add bank balance
      const bankIndex = existingBankBalances.findIndex(
        (b: any) => b.bankAccountId === bankAccountId
      );
      
      if (bankIndex >= 0) {
        const oldBalance = Number(existingBankBalances[bankIndex].balance) || 0;
        existingBankBalances[bankIndex].balance = Number(oldBalance + changeAmount);
        logger.info(`${isExpense ? 'Subtracted' : 'Added'} ${amount} ${isExpense ? 'from' : 'to'} bank ${bankAccountId} in closing balance for ${dateStr}: ${oldBalance} ${isExpense ? '-' : '+'} ${amount} = ${existingBankBalances[bankIndex].balance}`);
      } else {
        // For new bank in existing closing balance, get starting balance from opening balance or previous day
        let startingBalance = 0;
        
        // Check opening balance for this date
        const openingBalance = await prisma.dailyOpeningBalance.findUnique({
          where: { date: dateObj },
        });
        
        if (openingBalance) {
          const bankBalances = (openingBalance.bankBalances as any[]) || [];
          const bankBalance = bankBalances.find((b: any) => b.bankAccountId === bankAccountId);
          if (bankBalance) {
            startingBalance = Number(bankBalance.balance) || 0;
          }
        } else {
          // Check previous day's closing balance
          const previousDate = new Date(dateObj);
          previousDate.setDate(previousDate.getDate() - 1);
          previousDate.setHours(12, 0, 0, 0);
          const previousClosing = await prisma.dailyClosingBalance.findUnique({
            where: { date: previousDate },
          });
          if (previousClosing) {
            const prevBankBalances = (previousClosing.bankBalances as any[]) || [];
            const prevBankBalance = prevBankBalances.find((b: any) => b.bankAccountId === bankAccountId);
            if (prevBankBalance) {
              startingBalance = Number(prevBankBalance.balance) || 0;
            }
          }
        }
        
        existingBankBalances.push({ 
          bankAccountId, 
          balance: Number(startingBalance + changeAmount) 
        });
        logger.info(`${isExpense ? 'Subtracted' : 'Added'} ${amount} ${isExpense ? 'from' : 'to'} new bank ${bankAccountId} in closing balance for ${dateStr}: starting=${startingBalance}, ${isExpense ? '-' : '+'} ${amount} = ${startingBalance + changeAmount}`);
      }
    } else if (type === "card" && cardId) {
      // Find or add card balance
      const cardIndex = existingCardBalances.findIndex(
        (c: any) => c.cardId === cardId
      );
      
      if (cardIndex >= 0) {
        const oldBalance = Number(existingCardBalances[cardIndex].balance) || 0;
        existingCardBalances[cardIndex].balance = oldBalance + changeAmount;
        logger.info(`${isExpense ? 'Subtracted' : 'Added'} ${amount} ${isExpense ? 'from' : 'to'} card ${cardId} in closing balance for ${dateStr}: ${oldBalance} ${isExpense ? '-' : '+'} ${amount} = ${existingCardBalances[cardIndex].balance}`);
      } else {
        // For new card, if expense, start from 0 and subtract
        existingCardBalances.push({ cardId, balance: changeAmount });
        logger.info(`${isExpense ? 'Subtracted' : 'Added'} ${amount} ${isExpense ? 'from' : 'to'} new card ${cardId} in closing balance for ${dateStr}`);
      }
    }

    // Update the closing balance
    const updatedClosing = await prisma.dailyClosingBalance.update({
      where: { date: dateObj },
      data: {
        cashBalance: Number(updatedCashBalance),
        bankBalances: existingBankBalances.map((b: any) => ({
          bankAccountId: b.bankAccountId,
          balance: Number(b.balance)
        })) as any,
        cardBalances: existingCardBalances.map((c: any) => ({
          cardId: c.cardId,
          balance: Number(c.balance)
        })) as any,
        updatedAt: new Date(),
      },
    });

    logger.info(`Updated closing balance for ${dateStr}: cash=${updatedCashBalance}`);
    return updatedClosing;
  }

  /**
   * Get closing balance for a specific date
   */
  async getClosingBalance(date: string) {
    const dateObj = parseLocalYMDForDB(date);

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
      .map(([cardId, balance]: [string, number]) => ({ cardId, balance }));
  }

  /**
   * Get previous day's closing balance (which becomes next day's opening balance)
   */
  async getPreviousDayClosingBalance(date: string) {
    // Parse date string (YYYY-MM-DD) and get previous day using parseLocalYMD for consistency
    const current = parseLocalYMD(date);
    const previousDate = new Date(current);
    previousDate.setDate(previousDate.getDate() - 1);
    // Use noon for DB @db.Date column matching (same as calculateAndStoreClosingBalance)
    previousDate.setHours(12, 0, 0, 0);
    
    const previousDateStr = formatLocalYMD(previousDate);
    logger.info(`getPreviousDayClosingBalance: Looking for closing balance for date ${previousDateStr} (previous day of ${date})`);

    let previousClosing = await prisma.dailyClosingBalance.findUnique({
      where: { date: previousDate },
    });

    if (previousClosing) {
      logger.info(`getPreviousDayClosingBalance: Found closing balance for ${previousDateStr}: Cash=${previousClosing.cashBalance}, Banks=${(previousClosing.bankBalances as any[])?.length || 0}, Cards=${(previousClosing.cardBalances as any[])?.length || 0}`);
    } else {
      logger.warn(`getPreviousDayClosingBalance: No closing balance found for ${previousDateStr}, attempting to calculate...`);
    }

    // If not found, calculate and store it (e.g. 17th's closing when asking for 18th's opening)
    if (!previousClosing) {
      try {
        logger.info(`getPreviousDayClosingBalance: Calculating closing balance for ${previousDateStr}`);
        const calculated = await this.calculateAndStoreClosingBalance(previousDate);
        // Use the freshly calculated result directly
        if (calculated) {
          logger.info(`getPreviousDayClosingBalance: Successfully calculated closing balance for ${previousDateStr}: Cash=${calculated.cashBalance}, Banks=${(calculated.bankBalances as any[])?.length || 0}, Cards=${(calculated.cardBalances as any[])?.length || 0}`);
          return {
            date: formatLocalYMD(calculated.date),
            cashBalance: Number(calculated.cashBalance),
            bankBalances: (calculated.bankBalances as any[]) || [],
            cardBalances: (calculated.cardBalances as any[]) || [],
          };
        }
      } catch (error) {
        logger.error(`Error calculating closing balance for previous day: ${formatLocalYMD(previousDate)}`, error);
        return null;
      }
    }

    if (previousClosing) {
      return {
        date: formatLocalYMD(previousClosing.date),
        cashBalance: Number(previousClosing.cashBalance),
        bankBalances: (previousClosing.bankBalances as any[]) || [],
        cardBalances: (previousClosing.cardBalances as any[]) || [],
      };
    }

    logger.warn(`getPreviousDayClosingBalance: Returning null - no closing balance found for ${previousDateStr}`);
    return null;
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

    return closingBalances.map((cb: any) => ({
      date: formatLocalYMD(cb.date),
      cashBalance: Number(cb.cashBalance),
      bankBalances: (cb.bankBalances as any[]) || [],
    }));
  }
}

export default new DailyClosingBalanceService();

