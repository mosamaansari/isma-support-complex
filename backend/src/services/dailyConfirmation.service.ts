import prisma from "../config/database";
import logger from "../utils/logger";
import { Decimal } from "@prisma/client/runtime/library";
import dailyClosingBalanceService from "./dailyClosingBalance.service";
import balanceManagementService from "./balanceManagement.service";
import { formatLocalYMD, getTodayInPakistan } from "../utils/date";

interface DailyConfirmationStatus {
  needsConfirmation: boolean;
  confirmed: boolean;
  date: string;
  previousCashBalance: number;
  bankBalances: Array<{ bankAccountId: string; bankName: string; accountNumber: string; balance: number }>;
}

class DailyConfirmationService {
  /**
   * Check if daily confirmation is needed for today
   * Returns true if no confirmation exists for today or it's not confirmed
   */
  async checkConfirmationNeeded(): Promise<boolean> {
    // Use Pakistan timezone to get today's date
    const today = getTodayInPakistan();

    // Check if confirmation already exists for today
    const confirmation = await prisma.dailyConfirmation.findUnique({
      where: { date: today },
    });

    return !confirmation || !confirmation.confirmed;
  }

  /**
   * Get daily confirmation status with balances for a specific user
   */
  async getConfirmationStatus(userId?: string): Promise<DailyConfirmationStatus> {
    // Use Pakistan timezone to get current time and today's date
    const now = new Date();
    const pakistanTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Karachi" }));
    const today = getTodayInPakistan();

    // Check if it's after 12:10 AM or 12:30 AM in Pakistan timezone (cron runs at 12:00 AM)
    // Show popup after 12:10 AM (10 minutes after cron)
    const showAfterHour = 0; // 12:00 AM
    const showAfterMinute = 10; // 10 minutes past midnight
    
    const currentHour = pakistanTime.getHours();
    const currentMinute = pakistanTime.getMinutes();
    const shouldShow = currentHour > showAfterHour || (currentHour === showAfterHour && currentMinute >= showAfterMinute);

    // Get confirmation status for today
    const confirmation = await prisma.dailyConfirmation.findUnique({
      where: { date: today },
    });

    // Check if this specific user has confirmed (for per-user tracking)
    // Note: This is a simple check - for full per-user support, we'd need a separate table
    const userConfirmed = userId && confirmation?.confirmedBy === userId;
    const confirmed = confirmation?.confirmed || false;

    // If user has already confirmed, don't show popup
    if (userConfirmed) {
      return {
        needsConfirmation: false,
        confirmed: true,
        date: formatLocalYMD(today),
        previousCashBalance: 0,
        bankBalances: [],
      };
    }

    // Show modal if: not confirmed
    // Always calculate and return balances when not confirmed (even if before 12:10 AM for user convenience)
    const needsConfirmation = !confirmed;

    // Get CURRENT running balance for today (includes opening + additional amounts)
    // This uses balanceManagementService which correctly includes all transactions including "add_opening_balance"
    const currentCashBalance = await balanceManagementService.getCurrentCashBalance(today);
    
    // Get all active bank accounts
    const bankAccounts = await prisma.bankAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        bankName: true,
        accountNumber: true,
      },
    });

    // Get current balance for each bank account (includes opening + additional amounts)
    const currentBankBalances: Array<{ bankAccountId: string; bankName: string; accountNumber: string; balance: number }> = [];
    for (const account of bankAccounts) {
      const balance = await balanceManagementService.getCurrentBankBalance(account.id, today);
      currentBankBalances.push({
        bankAccountId: account.id,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        balance: balance,
      });
    }

    return {
      // Show modal if not confirmed AND (after 12:10 AM OR we allow anytime for convenience)
      // For now, allow showing anytime if not confirmed (remove time restriction for user convenience)
      needsConfirmation: needsConfirmation, // && shouldShow, // Removed time restriction
      confirmed: userConfirmed || false,
      date: formatLocalYMD(today),
      previousCashBalance: currentCashBalance, // Current day's running balance (includes opening + additional)
      bankBalances: currentBankBalances, // All active banks with their current balances (including 0 balance)
    };
  }

  /**
   * Calculate previous day's closing cash balance
   */
  private async calculatePreviousCashBalance(date: Date): Promise<number> {
    // Get opening balance for the date
    const openingBalance = await prisma.dailyOpeningBalance.findUnique({
      where: { date },
    });

    let cashBalance = openingBalance ? Number(openingBalance.cashBalance) : 0;

    // Get all cash transactions for the date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Calculate from sales (cash payments)
    const sales = await prisma.sale.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: "completed",
      },
      select: { payments: true },
    });

    for (const sale of sales) {
      if (sale.payments && Array.isArray(sale.payments)) {
        for (const payment of sale.payments as any[]) {
          if (payment.type === "cash") {
            cashBalance += Number(payment.amount || 0);
          }
        }
      }
    }

    // Subtract cash expenses
    const expenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        paymentType: "cash",
      },
      select: { amount: true },
    });

    for (const expense of expenses) {
      cashBalance -= Number(expense.amount);
    }

    // Subtract cash purchase payments
    const purchases = await prisma.purchase.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: "completed",
      },
      select: { payments: true },
    });

    for (const purchase of purchases) {
      if (purchase.payments && Array.isArray(purchase.payments)) {
        for (const payment of purchase.payments as any[]) {
          if (payment.type === "cash") {
            cashBalance -= Number(payment.amount || 0);
          }
        }
      }
    }

    return Math.max(0, cashBalance);
  }

  /**
   * Calculate previous day's closing bank balances
   */
  private async calculatePreviousBankBalances(date: Date): Promise<Array<{ bankAccountId: string; bankName: string; accountNumber: string; balance: number }>> {
    // Get all active bank accounts
    const bankAccounts = await prisma.bankAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        bankName: true,
        accountNumber: true,
      },
    });

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get opening balance for the date
    const openingBalance = await prisma.dailyOpeningBalance.findUnique({
      where: { date },
    });

    const bankBalancesMap = new Map<string, number>();

    // Initialize from opening balance
    if (openingBalance?.bankBalances && typeof openingBalance.bankBalances === 'object') {
      const balances = openingBalance.bankBalances as any;
      if (Array.isArray(balances)) {
        for (const balance of balances) {
          if (balance.bankAccountId && balance.balance) {
            bankBalancesMap.set(balance.bankAccountId, Number(balance.balance));
          }
        }
      }
    }

    // Initialize all bank accounts with 0 if not in opening balance
    for (const account of bankAccounts) {
      if (!bankBalancesMap.has(account.id)) {
        bankBalancesMap.set(account.id, 0);
      }
    }

    // Calculate from sales (bank payments)
    const sales = await prisma.sale.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: "completed",
      },
      select: { payments: true },
    });

    for (const sale of sales) {
      if (sale.payments && Array.isArray(sale.payments)) {
        for (const payment of sale.payments as any[]) {
          if (payment.type === "bank_transfer" && payment.bankAccountId) {
            const current = bankBalancesMap.get(payment.bankAccountId) || 0;
            bankBalancesMap.set(payment.bankAccountId, current + Number(payment.amount || 0));
          }
        }
      }
    }

    // Subtract bank expenses
    const expenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        paymentType: "bank_transfer",
      },
      select: { amount: true, bankAccountId: true },
    });

    for (const expense of expenses) {
      if (expense.bankAccountId) {
        const current = bankBalancesMap.get(expense.bankAccountId) || 0;
        bankBalancesMap.set(expense.bankAccountId, current - Number(expense.amount));
      }
    }

    // Subtract bank purchase payments
    const purchases = await prisma.purchase.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
        status: "completed",
      },
      select: { payments: true },
    });

    for (const purchase of purchases) {
      if (purchase.payments && Array.isArray(purchase.payments)) {
        for (const payment of purchase.payments as any[]) {
          if (payment.type === "bank_transfer" && payment.bankAccountId) {
            const current = bankBalancesMap.get(payment.bankAccountId) || 0;
            bankBalancesMap.set(payment.bankAccountId, current - Number(payment.amount || 0));
          }
        }
      }
    }

    // Convert to array format
    const result: Array<{ bankAccountId: string; bankName: string; accountNumber: string; balance: number }> = [];
    for (const account of bankAccounts) {
      const balance = Math.max(0, bankBalancesMap.get(account.id) || 0);
      result.push({
        bankAccountId: account.id,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        balance,
      });
    }

    return result;
  }

  /**
   * Confirm daily opening balance for a specific user
   * Note: Current implementation uses single confirmation per day.
   * For full per-user support, we'd need a separate UserDailyConfirmation table.
   * For now, we track the user who confirmed, and check if current user matches.
   */
  async confirmDaily(userInfo: { id: string; userType?: "user" | "admin" }): Promise<void> {
    // Use Pakistan timezone to get today's date
    const today = getTodayInPakistan();

    // Upsert confirmation - store which user confirmed
    // Note: This is a simplified per-user tracking. For true per-user support,
    // we'd need a separate table with userId + date as unique constraint.
    await prisma.dailyConfirmation.upsert({
      where: { date: today },
      update: {
        confirmed: true,
        confirmedBy: userInfo.id, // Store the user who confirmed
        confirmedByType: userInfo.userType || "user",
        confirmedAt: new Date(),
      },
      create: {
        date: today,
        confirmed: true,
        confirmedBy: userInfo.id,
        confirmedByType: userInfo.userType || "user",
        confirmedAt: new Date(),
      },
    });

    logger.info(`Daily confirmation completed for ${formatLocalYMD(today)} by ${userInfo.id}`);
  }
}

export default new DailyConfirmationService();

