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
    const dateStr = date.toISOString().split('T')[0];
    const dateObj = new Date(dateStr);
    dateObj.setHours(0, 0, 0, 0);
    const endDate = new Date(dateStr);
    endDate.setHours(23, 59, 59, 999);
    
    // Use transaction with locking
    return await prisma.$transaction(async (tx) => {
      // Get opening balance for the date
      const openingBalance = await tx.dailyOpeningBalance.findFirst({
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

      // If no opening balance exists, try to get previous day's closing balance
      const previousDate = new Date(date);
      previousDate.setDate(previousDate.getDate() - 1);

      const prevClosing = await tx.dailyClosingBalance.findUnique({
        where: { date: previousDate },
      });

      if (prevClosing) {
        return Number(prevClosing.cashBalance) || 0;
      }

      return 0;
    });
  }

  /**
   * Get current bank balance for a specific bank account and date
   * Uses row-level locking to prevent concurrent modifications
   */
  async getCurrentBankBalance(bankAccountId: string, date: Date): Promise<number> {
    // Ensure date is in local timezone, not UTC
    const localDate = new Date(date);
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    const dateObj = new Date(year, localDate.getMonth(), localDate.getDate());
    dateObj.setHours(0, 0, 0, 0);
    const endDate = new Date(year, localDate.getMonth(), localDate.getDate());
    endDate.setHours(23, 59, 59, 999);
    
    return await prisma.$transaction(async (tx) => {
      // Get opening balance with lock using findFirst
      const openingBalance = await tx.dailyOpeningBalance.findFirst({
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
      const previousDate = new Date(date);
      previousDate.setDate(previousDate.getDate() - 1);
      const prevClosing = await tx.dailyClosingBalance.findUnique({
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
    });
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
        // Create new opening balance
        todayBalance = await tx.dailyOpeningBalance.create({
          data: {
            date: new Date(dateStr),
            cashBalance: afterBalance,
            bankBalances: [],
            userId: actualUserId,
            userName: transactionData.userName,
            createdBy: transactionData.userId,
            createdByType: userType,
          },
        });
      } else {
        // Update existing balance
        todayBalance = await tx.dailyOpeningBalance.update({
          where: { id: todayBalance.id },
          data: {
            cashBalance: afterBalance,
            updatedBy: transactionData.userId,
            updatedByType: userType,
          },
        });
      }

      // Create balance transaction record with detailed tracking
      // Use current date and time for transaction
      const transactionDate = new Date(); // Always use current date and time
      
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
        todayBalance = await tx.dailyOpeningBalance.create({
          data: {
            date: new Date(dateStr),
            cashBalance: 0,
            bankBalances: updatedBankBalances,
            userId: actualUserId,
            userName: transactionData.userName,
            createdBy: transactionData.userId,
            createdByType: userType,
          },
        });
      } else {
        // Update existing balance
        todayBalance = await tx.dailyOpeningBalance.update({
          where: { id: todayBalance.id },
          data: {
            bankBalances: updatedBankBalances,
            updatedBy: transactionData.userId,
            updatedByType: userType,
          },
        });
      }

      // Create balance transaction record with detailed tracking
      // Use current date and time for transaction
      const transactionDate = new Date(); // Always use current date and time
      
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
   * Add to opening balance (manual addition)
   */
  async addToOpeningBalance(
    date: Date,
    amount: number,
    type: "cash" | "bank",
    transactionData: {
      description?: string;
      userId: string;
      userName: string;
      bankAccountId?: string;
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
    } else {
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
    }
  }
}

export default new BalanceManagementService();

