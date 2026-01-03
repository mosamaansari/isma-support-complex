import prisma from "../config/database";
import logger from "../utils/logger";
import balanceTransactionService from "./balanceTransaction.service";
import openingBalanceService from "./openingBalance.service";

interface BalanceUpdateResult {
  beforeBalance: number;
  afterBalance: number;
  changeAmount: number;
  transactionId: string;
}

/**
 * Balance Management Service
 * Handles atomic balance updates with locking to prevent conflicts
 * Similar to ATM transaction locking mechanism
 */
class BalanceManagementService {
  /**
   * Get current cash balance for a specific date
   * Uses row-level locking (SELECT FOR UPDATE) to prevent concurrent modifications
   */
  async getCurrentCashBalance(date: Date): Promise<number> {
    const localDate = new Date(date);
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const dateObj = new Date(year, localDate.getMonth(), localDate.getDate());
    dateObj.setHours(0, 0, 0, 0);
    const endDate = new Date(year, localDate.getMonth(), localDate.getDate());
    endDate.setHours(23, 59, 59, 999);

    // First, try to get the latest transaction for today
    const latestTransaction = await prisma.balanceTransaction.findFirst({
      where: {
        date: {
          gte: dateObj,
          lte: endDate,
        },
        paymentType: "cash",
      },
      orderBy: { createdAt: "desc" },
    });

    if (latestTransaction && latestTransaction.afterBalance !== null) {
      return Number(latestTransaction.afterBalance);
    }

    // If no transactions today, get opening balance for the date
    const openingBalance = await prisma.dailyOpeningBalance.findFirst({
      where: {
        date: {
          gte: dateObj,
          lte: endDate,
        },
      },
    });

    if (openingBalance) {
      return Number(openingBalance.cashBalance) || 0;
    }

    // If no opening balance exists, get previous day's closing balance
    const previousDate = new Date(dateObj);
    previousDate.setDate(previousDate.getDate() - 1);

    const prevClosing = await prisma.dailyClosingBalance.findUnique({
      where: { date: previousDate },
    });

    if (prevClosing) {
      return Number(prevClosing.cashBalance) || 0;
    }

    return 0;
  }

  /**
   * Get current bank balance for a specific bank account and date
   * Uses row-level locking to prevent concurrent modifications
   */
  async getCurrentBankBalance(bankAccountId: string, date: Date): Promise<number> {
    const localDate = new Date(date);
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const dateObj = new Date(year, localDate.getMonth(), localDate.getDate());
    dateObj.setHours(0, 0, 0, 0);
    const endDate = new Date(year, localDate.getMonth(), localDate.getDate());
    endDate.setHours(23, 59, 59, 999);

    // First, try to get the latest transaction for this bank today
    const latestTransaction = await prisma.balanceTransaction.findFirst({
      where: {
        date: {
          gte: dateObj,
          lte: endDate,
        },
        paymentType: "bank_transfer",
        bankAccountId: bankAccountId,
      },
      orderBy: { createdAt: "desc" },
    });

    if (latestTransaction && latestTransaction.afterBalance !== null) {
      return Number(latestTransaction.afterBalance);
    }

    // If no transactions today, get opening balance
    const openingBalance = await prisma.dailyOpeningBalance.findFirst({
      where: {
        date: {
          gte: dateObj,
          lte: endDate,
        },
      },
    });

    if (openingBalance) {
      const bankBalances = (openingBalance.bankBalances as Array<{ bankAccountId: string; balance: number }>) || [];
      const bankBalance = bankBalances.find((b) => b.bankAccountId === bankAccountId);
      if (bankBalance) {
        return Number(bankBalance.balance) || 0;
      }
    }

    // If no opening balance exists, try to get previous day's closing balance
    const previousDate = new Date(dateObj);
    previousDate.setDate(previousDate.getDate() - 1);
    const prevClosing = await prisma.dailyClosingBalance.findUnique({
      where: { date: previousDate },
    });

    if (prevClosing) {
      const bankBalances = (prevClosing.bankBalances as Array<{ bankAccountId: string; balance: number }>) || [];
      const bankBalance = bankBalances.find((b) => b.bankAccountId === bankAccountId);
      if (bankBalance) {
        return Number(bankBalance.balance) || 0;
      }
    }

    return 0;
  }

  /**
   * Update cash balance atomically with transaction tracking
   * Returns before and after balances
   */
  async updateCashBalance(
    date: Date,
    amount: number,
    type: "income" | "expense",
    transactionData: {
      description?: string;
      source: string;
      sourceId?: string;
      userId: string;
      userName: string;
    }
  ): Promise<BalanceUpdateResult> {
    return await prisma.$transaction(async (tx) => {
      // Ensure date is in local timezone, not UTC
      // Create date string from local date components to avoid timezone shifts
      const localDate = new Date(date);
      const year = localDate.getFullYear();
      const month = String(localDate.getMonth() + 1).padStart(2, '0');
      const day = String(localDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      // Get current balance with lock
      const beforeBalance = await this.getCurrentCashBalance(date);

      // Calculate new balance
      const changeAmount = type === "income" ? amount : -amount;
      const afterBalance = beforeBalance + changeAmount;

      // Ensure balance doesn't go negative
      if (afterBalance < 0) {
        throw new Error(`Insufficient cash balance. Available Balance: ${beforeBalance}, Required Amount: ${amount}`);
      }

      // Get or create opening balance for today
      let todayBalance = await tx.dailyOpeningBalance.findFirst({
        where: {
          date: {
            gte: new Date(dateStr + 'T00:00:00'),
            lte: new Date(dateStr + 'T23:59:59'),
          },
        },
      });

      // Verify user exists and determine if userId should be set (FK constraint only allows User table, not AdminUser)
      let actualUserId: string | null = null;
      let userType: "user" | "admin" = "user";

      if (transactionData.userId) {
        // Check if user exists in User table
        const user = await tx.user.findUnique({
          where: { id: transactionData.userId },
          select: { id: true },
        });

        if (user) {
          actualUserId = transactionData.userId;
          userType = "user";
        } else {
          // Check if it's an admin user
          const adminUser = await tx.adminUser.findUnique({
            where: { id: transactionData.userId },
            select: { id: true },
          });

          if (adminUser) {
            // For admin users, set userId to null because foreign key constraint
            // only allows values from users table, not admin_users table
            actualUserId = null;
            userType = "admin";
          } else {
            // User not found in either table, but we'll still proceed with null userId
            actualUserId = null;
            userType = "user";
          }
        }
      }

      if (!todayBalance) {
        // Create new opening balance record - this should represent the balance at START of day
        // We use beforeBalance if it's the first transaction
        await tx.dailyOpeningBalance.create({
          data: {
            date: new Date(dateStr),
            cashBalance: beforeBalance,
            bankBalances: [],
            userId: actualUserId,
            userName: transactionData.userName,
            createdBy: transactionData.userId,
            createdByType: userType,
          },
        });
      }
      // Note: We no longer update todayBalance.cashBalance here.
      // It stays as the initial opening balance for the day.
      // Running balance is tracked via BalanceTransactions and latest transaction afterBalance.

      // Create balance transaction record with detailed tracking
      // Use the provided date but with current time to preserve exact transaction time
      const now = new Date();
      const transactionDate = new Date(date);
      transactionDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

      const transaction = await balanceTransactionService.createTransaction({
        date: transactionDate,
        type: type,
        amount: amount,
        paymentType: "cash",
        bankAccountId: undefined,
        description: transactionData.description,
        source: transactionData.source,
        sourceId: transactionData.sourceId,
        userId: transactionData.userId,
        userName: transactionData.userName,
        beforeBalance: beforeBalance,
        afterBalance: afterBalance,
        changeAmount: changeAmount,
      });

      return {
        beforeBalance,
        afterBalance,
        changeAmount,
        transactionId: transaction.id,
      };
    });
  }

  /**
   * Update bank balance atomically with transaction tracking
   * Returns before and after balances
   */
  async updateBankBalance(
    bankAccountId: string,
    date: Date,
    amount: number,
    type: "income" | "expense",
    transactionData: {
      description?: string;
      source: string;
      sourceId?: string;
      userId: string;
      userName: string;
    }
  ): Promise<BalanceUpdateResult> {
    return await prisma.$transaction(async (tx) => {
      // Ensure date is in local timezone, not UTC
      // Create date string from local date components to avoid timezone shifts
      const localDate = new Date(date);
      const year = localDate.getFullYear();
      const month = String(localDate.getMonth() + 1).padStart(2, '0');
      const day = String(localDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      // Get current balance with lock
      const beforeBalance = await this.getCurrentBankBalance(bankAccountId, date);

      // Calculate new balance
      const changeAmount = type === "income" ? amount : -amount;
      const afterBalance = beforeBalance + changeAmount;

      // Ensure balance doesn't go negative
      if (afterBalance < 0) {
        throw new Error(`Insufficient bank balance. Available Balance: ${beforeBalance}, Required Amount: ${amount}`);
      }

      // Get or create opening balance for today
      let todayBalance = await tx.dailyOpeningBalance.findFirst({
        where: {
          date: {
            gte: new Date(dateStr + 'T00:00:00'),
            lte: new Date(dateStr + 'T23:59:59'),
          },
        },
      });

      const bankBalances = todayBalance
        ? ((todayBalance.bankBalances as Array<{ bankAccountId: string; balance: number }>) || [])
        : [];

      // Find or create bank balance entry
      let updatedBankBalances = [...bankBalances];
      const bankIndex = updatedBankBalances.findIndex(
        (b: any) => b.bankAccountId === bankAccountId
      );

      if (bankIndex >= 0) {
        updatedBankBalances[bankIndex].balance = afterBalance;
      } else {
        updatedBankBalances.push({
          bankAccountId: bankAccountId,
          balance: afterBalance,
        });
      }

      // Verify user exists and determine if userId should be set (FK constraint only allows User table, not AdminUser)
      let actualUserId: string | null = null;
      let userType: "user" | "admin" = "user";

      if (transactionData.userId) {
        // Check if user exists in User table
        const user = await tx.user.findUnique({
          where: { id: transactionData.userId },
          select: { id: true },
        });

        if (user) {
          actualUserId = transactionData.userId;
          userType = "user";
        } else {
          // Check if it's an admin user
          const adminUser = await tx.adminUser.findUnique({
            where: { id: transactionData.userId },
            select: { id: true },
          });

          if (adminUser) {
            // For admin users, set userId to null because foreign key constraint
            // only allows values from users table, not admin_users table
            actualUserId = null;
            userType = "admin";
          } else {
            // User not found in either table, but we'll still proceed with null userId
            actualUserId = null;
            userType = "user";
          }
        }
      }

      if (!todayBalance) {
        // Create new opening balance
        await tx.dailyOpeningBalance.create({
          data: {
            date: new Date(dateStr),
            cashBalance: 0,
            bankBalances: updatedBankBalances.map(b =>
              b.bankAccountId === bankAccountId ? { ...b, balance: beforeBalance } : b
            ),
            userId: actualUserId,
            userName: transactionData.userName,
            createdBy: transactionData.userId,
            createdByType: userType,
          },
        });
      }
      // Note: We no longer update todayBalance.bankBalances here.
      // It stays as the initial opening balance for the day.

      // Create balance transaction record with detailed tracking
      // Use the provided date but with current time to preserve exact transaction time
      const now = new Date();
      const transactionDate = new Date(date);
      transactionDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

      const transaction = await balanceTransactionService.createTransaction({
        date: transactionDate,
        type: type,
        amount: amount,
        paymentType: "bank_transfer",
        bankAccountId: bankAccountId,
        description: transactionData.description,
        source: transactionData.source,
        sourceId: transactionData.sourceId,
        userId: transactionData.userId,
        userName: transactionData.userName,
        beforeBalance: beforeBalance,
        afterBalance: afterBalance,
        changeAmount: changeAmount,
      });

      return {
        beforeBalance,
        afterBalance,
        changeAmount,
        transactionId: transaction.id,
      };
    });
  }

  /**
   * Get current card balance for a specific card and date
   */
  async getCurrentCardBalance(cardId: string, date: Date): Promise<number> {
    const localDate = new Date(date);
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    const dateObj = new Date(year, localDate.getMonth(), localDate.getDate());
    dateObj.setHours(0, 0, 0, 0);
    const endDate = new Date(year, localDate.getMonth(), localDate.getDate());
    endDate.setHours(23, 59, 59, 999);

    // First, try to get the latest transaction for this card today
    const latestTransaction = await prisma.balanceTransaction.findFirst({
      where: {
        date: {
          gte: dateObj,
          lte: endDate,
        },
        paymentType: "card",
        sourceId: cardId, // We'll store cardId in sourceId or equivalent if we don't have a column
      },
      orderBy: { createdAt: "desc" },
    });

    // Actually, balanceTransaction doesn't have a cardId field. 
    // We should use a separate logic or add cardId to BalanceTransaction.
    // For now, let's look at sourceId if source is "card_adjustment" or similar.
    // BUT the easiest is to just use the one recorded with bankAccountId if we treat Cards as BankAccounts.
    // HOWEVER, the user wants cards separate. 

    // Let's use bankAccountId field in BalanceTransaction but set paymentType to "card".
    const latestCardTransaction = await prisma.balanceTransaction.findFirst({
      where: {
        date: {
          gte: dateObj,
          lte: endDate,
        },
        paymentType: "card",
        bankAccountId: cardId, // Reuse bankAccountId field for cardId when paymentType is card
      },
      orderBy: { createdAt: "desc" },
    });

    if (latestCardTransaction && latestCardTransaction.afterBalance !== null) {
      return Number(latestCardTransaction.afterBalance);
    }

    // If no transactions today, get opening balance
    const openingBalance = await prisma.dailyOpeningBalance.findFirst({
      where: {
        date: {
          gte: dateObj,
          lte: endDate,
        },
      },
    });

    if (openingBalance) {
      const cardBalances = (openingBalance.cardBalances as Array<{ cardId: string; balance: number }>) || [];
      const cardBalance = cardBalances.find((b) => b.cardId === cardId);
      if (cardBalance) {
        return Number(cardBalance.balance) || 0;
      }
    }

    // If no opening balance exists, try to get previous day's closing balance
    const previousDate = new Date(dateObj);
    previousDate.setDate(previousDate.getDate() - 1);
    const prevClosing = await prisma.dailyClosingBalance.findUnique({
      where: { date: previousDate },
    });

    if (prevClosing) {
      const cardBalances = (prevClosing.cardBalances as Array<{ cardId: string; balance: number }>) || [];
      const cardBalance = cardBalances.find((b) => b.cardId === cardId);
      if (cardBalance) {
        return Number(cardBalance.balance) || 0;
      }
    }

    return 0;
  }

  /**
   * Update card balance atomically with transaction tracking
   * Returns before and after balances
   */
  async updateCardBalance(
    cardId: string,
    date: Date,
    amount: number,
    type: "income" | "expense",
    transactionData: {
      description?: string;
      source: string;
      sourceId?: string;
      userId: string;
      userName: string;
    }
  ): Promise<BalanceUpdateResult> {
    return await prisma.$transaction(async (tx) => {
      const localDate = new Date(date);
      const year = localDate.getFullYear();
      const month = String(localDate.getMonth() + 1).padStart(2, '0');
      const day = String(localDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      // Get current balance
      const beforeBalance = await this.getCurrentCardBalance(cardId, date);

      // Calculate new balance
      const changeAmount = type === "income" ? amount : -amount;
      const afterBalance = beforeBalance + changeAmount;

      // Ensure balance doesn't go negative
      if (afterBalance < 0) {
        throw new Error(`Insufficient card balance. Available Balance: ${beforeBalance}, Required Amount: ${amount}`);
      }

      // Get or create opening balance for today
      let todayBalance = await tx.dailyOpeningBalance.findFirst({
        where: {
          date: {
            gte: new Date(dateStr + 'T00:00:00'),
            lte: new Date(dateStr + 'T23:59:59'),
          },
        },
      });

      const cardBalances = todayBalance
        ? ((todayBalance.cardBalances as Array<{ cardId: string; balance: number }>) || [])
        : [];

      // Find or create card balance entry
      let updatedCardBalances = [...cardBalances];
      const cardIndex = updatedCardBalances.findIndex(
        (b: any) => b.cardId === cardId
      );

      if (cardIndex >= 0) {
        // We don't update the baseline here, it stays as opening balance
      } else {
        updatedCardBalances.push({
          cardId: cardId,
          balance: beforeBalance, // Opening balance for this card
        });
      }

      // Verify user exists
      let actualUserId: string | null = null;
      let userType: "user" | "admin" = "user";

      if (transactionData.userId) {
        const user = await tx.user.findUnique({ where: { id: transactionData.userId } });
        if (user) {
          actualUserId = transactionData.userId;
        } else {
          actualUserId = null;
          userType = "admin";
        }
      }

      if (!todayBalance) {
        // Create new opening balance record
        await tx.dailyOpeningBalance.create({
          data: {
            date: new Date(dateStr),
            cashBalance: 0,
            bankBalances: [],
            cardBalances: updatedCardBalances,
            userId: actualUserId,
            userName: transactionData.userName,
            createdBy: transactionData.userId,
            createdByType: userType,
          },
        });
      }

      // Create balance transaction record
      // Use the provided date but with current time to preserve exact transaction time
      const now = new Date();
      const transactionDate = new Date(date);
      transactionDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
      
      const transaction = await balanceTransactionService.createTransaction({
        date: transactionDate,
        type: type,
        amount: amount,
        paymentType: "card",
        bankAccountId: cardId, // Reuse bankAccountId for cardId
        description: transactionData.description,
        source: transactionData.source,
        sourceId: transactionData.sourceId,
        userId: transactionData.userId,
        userName: transactionData.userName,
        beforeBalance: beforeBalance,
        afterBalance: afterBalance,
        changeAmount: changeAmount,
      });

      return {
        beforeBalance,
        afterBalance,
        changeAmount,
        transactionId: transaction.id,
      };
    });
  }

  /**
   * Add to opening balance (manual addition)
   */
  async addToOpeningBalance(
    date: Date,
    amount: number,
    type: "cash" | "bank" | "card",
    transactionData: {
      description?: string;
      userId: string;
      userName: string;
      bankAccountId?: string;
      cardId?: string;
    }
  ): Promise<BalanceUpdateResult> {
    if (type === "cash") {
      return await this.updateCashBalance(
        date,
        amount,
        "income",
        {
          description: transactionData.description || "Add Opening Balance",
          source: "add_opening_balance",
          userId: transactionData.userId,
          userName: transactionData.userName,
        }
      );
    } else if (type === "bank") {
      if (!transactionData.bankAccountId) {
        throw new Error("Bank account ID is required for bank balance updates");
      }
      return await this.updateBankBalance(
        transactionData.bankAccountId,
        date,
        amount,
        "income",
        {
          description: transactionData.description || "Add Opening Balance",
          source: "add_opening_balance",
          userId: transactionData.userId,
          userName: transactionData.userName,
        }
      );
    } else {
      if (!transactionData.cardId) {
        throw new Error("Card ID is required for card balance updates");
      }
      return await this.updateCardBalance(
        transactionData.cardId,
        date,
        amount,
        "income",
        {
          description: transactionData.description || "Add Opening Balance",
          source: "add_opening_balance",
          userId: transactionData.userId,
          userName: transactionData.userName,
        }
      );
    }
  }
}

export default new BalanceManagementService();

