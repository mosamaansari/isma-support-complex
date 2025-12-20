import prisma from "../config/database";
import logger from "../utils/logger";
import { Decimal } from "@prisma/client/runtime/library";

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if confirmation already exists for today
    const confirmation = await prisma.dailyConfirmation.findUnique({
      where: { date: today },
    });

    return !confirmation || !confirmation.confirmed;
  }

  /**
   * Get daily confirmation status with balances
   */
  async getConfirmationStatus(): Promise<DailyConfirmationStatus> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Get confirmation status for today
    const confirmation = await prisma.dailyConfirmation.findUnique({
      where: { date: today },
    });

    const confirmed = confirmation?.confirmed || false;

    // If already confirmed, don't need confirmation
    if (confirmed) {
      return {
        needsConfirmation: false,
        confirmed: true,
        date: today.toISOString().split('T')[0],
        previousCashBalance: 0,
        bankBalances: [],
      };
    }

    // Check if there's no opening balance for today (first time setup)
    const hasTodayOpeningBalance = await prisma.dailyOpeningBalance.findUnique({
      where: { date: today },
    });

    // Show modal if: not confirmed (anytime, no time restriction)
    const needsConfirmation = !confirmed;

    // Calculate previous day's closing balances from transactions
    const previousCashBalance = await this.calculatePreviousCashBalance(yesterday);
    const previousBankBalances = await this.calculatePreviousBankBalances(yesterday);

    return {
      needsConfirmation,
      confirmed,
      date: today.toISOString().split('T')[0],
      previousCashBalance,
      bankBalances: previousBankBalances,
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
   * Confirm daily opening balance
   */
  async confirmDaily(userInfo: { id: string; userType?: "user" | "admin" }): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Upsert confirmation
    await prisma.dailyConfirmation.upsert({
      where: { date: today },
      update: {
        confirmed: true,
        confirmedBy: userInfo.id,
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

    logger.info(`Daily confirmation completed for ${today.toISOString().split('T')[0]} by ${userInfo.id}`);
  }
}

export default new DailyConfirmationService();

