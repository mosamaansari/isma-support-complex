import prisma from "../config/database";
import logger from "../utils/logger";
import PDFDocument from "pdfkit";
import { Response } from "express";
import { formatLocalYMD, parseLocalYMD, parseLocalISO } from "../utils/date";
import balanceTransactionService from "./balanceTransaction.service";
import dailyClosingBalanceService from "./dailyClosingBalance.service";

/**
 * Normalize a date to noon (12:00:00) for consistent date comparison
 * This avoids timezone conversion issues when comparing dates
 */
function normalizeDateToNoon(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

/**
 * Extract date components from a Date object, accounting for UTC storage
 * When dates are stored in UTC in the database, we need to extract UTC components
 * to get the correct date in Pakistan timezone
 */
function extractDateComponents(date: Date): { year: number; month: number; day: number } {
  // When dates are stored in the database, they're stored in UTC
  // When Prisma returns them, they come as Date objects
  // We need to extract the date components that represent the actual date in Pakistan timezone
  // Since dates stored with -5 hours offset represent the correct Pakistan date,
  // we should use local date components (which JavaScript correctly interprets)
  // However, to be safe, we'll check both UTC and local and use the one that makes sense
  
  // Try UTC first (for dates stored as UTC ISO strings)
  const utcYear = date.getUTCFullYear();
  const utcMonth = date.getUTCMonth();
  const utcDay = date.getUTCDate();
  
  // Also get local components
  const localYear = date.getFullYear();
  const localMonth = date.getMonth();
  const localDay = date.getDate();
  
  // If UTC and local are different, it means the date crosses a day boundary
  // In that case, we should use the date that represents the actual intended date
  // For Pakistan timezone (UTC+5), if UTC date is different, use local (which is correct for Pakistan)
  if (utcYear !== localYear || utcMonth !== localMonth || utcDay !== localDay) {
    // Date crosses day boundary - use local date components (Pakistan timezone)
    return { year: localYear, month: localMonth, day: localDay };
  }
  
  // If they're the same, use UTC (more reliable for stored dates)
  return { year: utcYear, month: utcMonth, day: utcDay };
}

/**
 * Parse payment date from UTC ISO string to local date for comparison
 * Payment dates are stored in UTC format (e.g., "2026-01-03T08:59:16.870Z")
 * We extract UTC date components and create a local date for comparison
 */
function parsePaymentDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  
  let date: Date;
  
  // If it's a UTC ISO string (ends with Z), extract UTC components
  if (typeof dateStr === 'string' && dateStr.endsWith('Z')) {
    date = new Date(dateStr);
    // Extract UTC date components to get the correct date in Pakistan timezone
    const { year, month, day } = extractDateComponents(date);
    // Create a local date with UTC components at noon for comparison
    return new Date(year, month, day, 12, 0, 0, 0);
  } else {
    // Try parseLocalISO for local ISO strings
    try {
      date = parseLocalISO(dateStr);
    } catch {
      // Fallback to regular Date parsing
      date = new Date(dateStr);
    }
    // Extract date components and normalize to noon
    const { year, month, day } = extractDateComponents(date);
    return new Date(year, month, day, 12, 0, 0, 0);
  }
}

/**
 * Comprehensive Report Service
 * Provides accurate step-by-step balance calculations for:
 * - Daily reports
 * - Monthly reports  
 * - Custom date range reports
 * 
 * All reports show:
 * - Opening balance
 * - Balance after adding opening amount
 * - Balance after expenses
 * - Balance after sales
 * - Balance after purchases
 * 
 * Everything sorted by date and time (ASC)
 */
class ReportService {
  /**
   * Get comprehensive daily report with step-by-step balance calculations
   */
  async getDailyReport(date: string) {
    const dateObj = parseLocalYMD(date);
    // Use noon (12:00:00) for date comparisons to avoid timezone conversion issues
    // Pakistan is UTC+5, so 12:00 PKT = 07:00 UTC (same date)
    const startOfDay = new Date(dateObj);
    startOfDay.setHours(12, 0, 0, 0); // Use noon instead of midnight
    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999); // Use end of day for full day coverage

    // IMPORTANT: Opening Balance = Previous day's closing balance (baseline only)
    // It should NOT include manual additions made today
    // Get previous day's closing balance as the opening balance
    const previousClosing = await dailyClosingBalanceService.getPreviousDayClosingBalance(date);
    
    let openingBalance: any;
    if (previousClosing) {
      // Use previous day's closing as today's opening balance (baseline)
      openingBalance = {
        id: `opening-${date}`,
        date: dateObj,
        cashBalance: previousClosing.cashBalance,
        bankBalances: previousClosing.bankBalances as any,
        cardBalances: previousClosing.cardBalances as any,
        notes: "Previous day's closing balance (baseline)",
        userId: null,
        userName: "System",
        createdAt: dateObj,
        updatedAt: dateObj,
        createdBy: null,
        createdByType: null,
        updatedBy: null,
        updatedByType: null,
      };
    } else {
      // No previous closing, start with zero
      openingBalance = {
        id: `zero-${date}`,
        date: dateObj,
        cashBalance: 0,
        bankBalances: [],
        cardBalances: [],
        notes: "No previous balance found",
        userId: null,
        userName: "System",
        createdAt: dateObj,
        updatedAt: dateObj,
        createdBy: null,
        createdByType: null,
        updatedBy: null,
        updatedByType: null,
      };
    }

    // Get all balance transactions for this date, sorted by createdAt (ASC)
    const transactions = await balanceTransactionService.getTransactions({
      startDate: date,
      endDate: date,
    });

    // Sort by createdAt ascending (oldest first)
    transactions.sort((a: any, b: any) => {
      const aTime = new Date(a.createdAt || a.date).getTime();
      const bTime = new Date(b.createdAt || b.date).getTime();
      return aTime - bTime;
    });

    // Get bank accounts for mapping
    const banks = await prisma.bankAccount.findMany({ where: { isActive: true } });
    const bankMap = new Map(banks.map((b) => [b.id, b]));

    // Build step-by-step transaction list
    const steps: any[] = [];
    
    // Starting balance
    const openingCash = Number(openingBalance.cashBalance || 0);
    const openingBankBalances = (openingBalance.bankBalances as Array<{ bankAccountId: string; balance: number }>) || [];
    
    let runningCash = openingCash;
    const runningBankBalances = new Map<string, number>();
    openingBankBalances.forEach((b) => {
      runningBankBalances.set(b.bankAccountId, Number(b.balance || 0));
    });

    // Add opening balance step
    steps.push({
      step: 1,
      type: "Opening Balance",
      datetime: startOfDay,
      cashBefore: openingCash,
      cashAfter: openingCash,
      cashChange: 0,
      bankBalancesBefore: openingBankBalances.map((b) => ({
        bankAccountId: b.bankAccountId,
        bankName: bankMap.get(b.bankAccountId)?.bankName || "Unknown",
        accountNumber: bankMap.get(b.bankAccountId)?.accountNumber || "",
        balance: Number(b.balance || 0),
      })),
      bankBalancesAfter: openingBankBalances.map((b) => ({
        bankAccountId: b.bankAccountId,
        bankName: bankMap.get(b.bankAccountId)?.bankName || "Unknown",
        accountNumber: bankMap.get(b.bankAccountId)?.accountNumber || "",
        balance: Number(b.balance || 0),
      })),
      description: "Opening Balance",
      source: "Opening Balance",
    });

    // Process each transaction in chronological order
    let stepNumber = 2;
    for (const tx of transactions) {
      // IMPORTANT: Skip 'opening_balance' transactions to avoid double counting
      // The opening balance is already set from previous day's closing balance
      // These transactions represent the initial baseline setting and should not be processed again
      if (tx.source === "opening_balance") {
        logger.info(`Skipping opening_balance transaction in report: ${tx.id}, amount=${tx.amount}`);
        continue;
      }

      // IMPORTANT: Filter transactions by actual date to ensure only transactions for the selected date are included
      // Use the transaction's date field (not createdAt) as it represents the actual transaction date
      // Database stores dates in UTC, so we extract UTC date components for correct comparison
      const txDate = tx.date ? new Date(tx.date) : new Date(tx.createdAt);
      
      // Extract date components (accounting for UTC storage)
      const { year: txYear, month: txMonth, day: txDay } = extractDateComponents(txDate);
      const txDateOnly = new Date(txYear, txMonth, txDay, 12, 0, 0, 0);
      
      const reportYear = dateObj.getFullYear();
      const reportMonth = dateObj.getMonth();
      const reportDay = dateObj.getDate();
      const reportDateOnly = new Date(reportYear, reportMonth, reportDay, 12, 0, 0, 0);
      
      // Skip transactions that don't match the report date
      if (txDateOnly.getTime() !== reportDateOnly.getTime()) {
        logger.info(`Skipping transaction ${tx.id} - date mismatch: txDate=${txYear}-${String(txMonth + 1).padStart(2, '0')}-${String(txDay).padStart(2, '0')}, reportDate=${reportYear}-${String(reportMonth + 1).padStart(2, '0')}-${String(reportDay).padStart(2, '0')}`);
        continue;
      }

      const paymentType = tx.paymentType || "cash";
      const amount = Number(tx.amount || 0);
      const type = tx.type || "income";

      // Determine transaction type and description
      let txType = "Transaction";
      let description = tx.description || "";
      
      if (tx.source === "sale" || tx.source === "sale_payment") {
        txType = "Sale";
        const sale = await prisma.sale.findUnique({ where: { id: tx.sourceId || "" }, include: { customer: true } }).catch((): null => null);
        if (sale) {
          description = `Sale - Bill #${sale.billNumber}${sale.customerName ? ` - ${sale.customerName}` : ""}`;
        }
      } else if (tx.source === "sale_refund") {
        txType = "Sale Refund";
        const sale = await prisma.sale.findUnique({ where: { id: tx.sourceId || "" }, include: { customer: true } }).catch((): null => null);
        if (sale) {
          description = `Sale Refund - Bill #${sale.billNumber}${sale.customerName ? ` - ${sale.customerName}` : ""}`;
        } else {
          description = tx.description || "Sale Refund";
        }
      } else if (tx.source === "purchase" || tx.source === "purchase_payment") {
        txType = "Purchase";
        const purchase = await prisma.purchase.findUnique({ where: { id: tx.sourceId || "" }, include: { supplier: true } }).catch((): null => null);
        if (purchase) {
          description = `Purchase - ${purchase.supplierName || "N/A"}`;
        }
      } else if (tx.source === "purchase_refund") {
        txType = "Purchase Refund";
        const purchase = await prisma.purchase.findUnique({ where: { id: tx.sourceId || "" }, include: { supplier: true } }).catch((): null => null);
        if (purchase) {
          description = `Purchase Refund - ${purchase.supplierName || "N/A"}`;
        } else {
          description = tx.description || "Purchase Refund";
        }
      } else if (tx.source === "expense") {
        txType = "Expense";
        const expense = await prisma.expense.findUnique({ where: { id: tx.sourceId || "" } }).catch((): null => null);
        if (expense) {
          description = `Expense - ${expense.category}${expense.description ? `: ${expense.description}` : ""}`;
        }
      } else if (tx.source?.includes("opening_balance") || tx.source === "add_opening_balance") {
        txType = "Opening Balance Addition";
        description = tx.description || "Opening Balance Addition";
      }

      // Calculate before and after balances
      const cashBefore = runningCash;
      const bankBalancesBefore = Array.from(runningBankBalances.entries()).map(([id, balance]) => ({
        bankAccountId: id,
        bankName: bankMap.get(id)?.bankName || "Unknown",
        accountNumber: bankMap.get(id)?.accountNumber || "",
        balance,
      }));

      // Update running balances
      if (paymentType === "cash") {
        if (type === "income") {
          runningCash += amount;
        } else {
          runningCash -= amount;
        }
      } else if (paymentType === "bank_transfer" && tx.bankAccountId) {
        const current = runningBankBalances.get(tx.bankAccountId) || 0;
        if (type === "income") {
          runningBankBalances.set(tx.bankAccountId, current + amount);
      } else {
          runningBankBalances.set(tx.bankAccountId, current - amount);
        }
      }

      const cashAfter = runningCash;
      const bankBalancesAfter = Array.from(runningBankBalances.entries()).map(([id, balance]) => ({
        bankAccountId: id,
        bankName: bankMap.get(id)?.bankName || "Unknown",
        accountNumber: bankMap.get(id)?.accountNumber || "",
        balance,
      }));

      // Double-check: Only add to steps if date matches (extra safety check for daily report)
      // Database stores dates in UTC, so we extract UTC date components for correct comparison
      const finalTxDate = new Date(tx.date || tx.createdAt);
      const { year, month, day } = extractDateComponents(finalTxDate);
      const finalTxDateOnly = new Date(year, month, day, 12, 0, 0, 0);
      const reportDateOnlyCheck = normalizeDateToNoon(dateObj);
      
      if (finalTxDateOnly.getTime() === reportDateOnlyCheck.getTime()) {
        steps.push({
          step: stepNumber++,
          type: txType,
          transactionType: type, // "income" or "expense"
          datetime: txDate,
          paymentType,
          amount,
          cashBefore,
          cashAfter,
          cashChange: type === "income" ? amount : -amount,
          bankAccountId: tx.bankAccountId,
          bankName: tx.bankAccountId ? bankMap.get(tx.bankAccountId)?.bankName : null,
          bankBalancesBefore,
          bankBalancesAfter,
          description,
          source: tx.source || "unknown",
          sourceId: tx.sourceId,
          userName: tx.userName,
        });
      } else {
        logger.warn(`Transaction ${tx.id} date check failed in daily report steps push: txDate=${finalTxDateOnly.toISOString().split('T')[0]}, reportDate=${reportDateOnlyCheck.toISOString().split('T')[0]}`);
      }
    }

    // Calculate closing balance
    // First, try to get the stored closing balance for this date (most accurate)
    // This ensures refunds and all transactions are included
    let closingCash = runningCash;
    let closingBankBalances = Array.from(runningBankBalances.entries()).map(([id, balance]) => ({
      bankAccountId: id,
      bankName: bankMap.get(id)?.bankName || "Unknown",
      accountNumber: bankMap.get(id)?.accountNumber || "",
      balance,
    }));

    // Try to get stored closing balance for this date (more accurate, includes all transactions)
    try {
      const storedClosingBalance = await dailyClosingBalanceService.getClosingBalance(date);
      if (storedClosingBalance) {
        // Use stored closing balance as it's more accurate (includes all transactions including refunds)
        closingCash = Number(storedClosingBalance.cashBalance || 0);
        const storedBanks = (storedClosingBalance.bankBalances as Array<{ bankAccountId: string; balance: number }>) || [];
        closingBankBalances = storedBanks.map((b) => ({
          bankAccountId: b.bankAccountId,
          bankName: bankMap.get(b.bankAccountId)?.bankName || "Unknown",
          accountNumber: bankMap.get(b.bankAccountId)?.accountNumber || "",
          balance: Number(b.balance || 0),
        }));
        logger.info(`Using stored closing balance for ${date}: cash=${closingCash}`);
      } else {
        logger.info(`No stored closing balance found for ${date}, using calculated balance: cash=${closingCash}`);
      }
    } catch (error: any) {
      logger.warn(`Error fetching stored closing balance for ${date}, using calculated balance: ${error.message}`);
      // Continue with calculated balance if stored balance fetch fails
    }

    // IMPORTANT: For Sales and Purchases, we need to look at PAYMENT DATES, not sale/purchase dates
    // Fetch all sales and purchases that might have payments on this date
    // We'll filter by payment dates later
    const allSales = await prisma.sale.findMany({
      where: {
        // Fetch sales from a wider range to catch payments that might be on different dates
        createdAt: { gte: new Date(startOfDay.getTime() - 30 * 24 * 60 * 60 * 1000) }, // 30 days before
      },
      include: { customer: true },
      orderBy: { createdAt: "asc" },
    });

    const allPurchases = await prisma.purchase.findMany({
      where: {
        // Fetch purchases from a wider range to catch payments that might be on different dates
        createdAt: { gte: new Date(startOfDay.getTime() - 30 * 24 * 60 * 60 * 1000) }, // 30 days before
      },
      include: { supplier: true },
      orderBy: { createdAt: "asc" },
    });

    // Filter sales by payment dates (not sale date)
    const sales = allSales.filter((sale) => {
      const payments = (sale.payments as Array<{ type?: string; amount?: number; date?: string; cardId?: string; bankAccountId?: string }> | null) || [];
      if (payments.length === 0) {
        // If no payments array, check if sale date matches
        // Database stores dates in UTC, so we extract UTC date components for correct comparison
        const saleDate = new Date(sale.date);
        const { year: saleYear, month: saleMonth, day: saleDay } = extractDateComponents(saleDate);
        const saleDateOnly = new Date(saleYear, saleMonth, saleDay, 12, 0, 0, 0);
        return saleDateOnly.getTime() === startOfDay.getTime();
      }
      // Check if any payment has a date matching the target date
      return payments.some((payment) => {
        if (!payment.date) {
          // If payment has no date, use sale date
          // Database stores dates in UTC, so we extract UTC date components for correct comparison
          const saleDate = new Date(sale.date);
          const { year: saleYear, month: saleMonth, day: saleDay } = extractDateComponents(saleDate);
          // Normalize to noon (12:00:00) for consistent date comparison
          const saleDateOnly = new Date(saleYear, saleMonth, saleDay, 12, 0, 0, 0);
          return saleDateOnly.getTime() === startOfDay.getTime();
        }
        const paymentDateOnly = parsePaymentDate(payment.date);
        if (!paymentDateOnly) return false;
        return paymentDateOnly.getTime() === startOfDay.getTime();
      });
    });

    // Filter purchases by payment dates (not purchase date)
    const purchases = allPurchases.filter((purchase) => {
      const payments = (purchase.payments as Array<{ type?: string; amount?: number; date?: string; cardId?: string; bankAccountId?: string }> | null) || [];
      if (payments.length === 0) {
        // If no payments array, check if purchase date matches
        // Database stores dates in UTC, so we extract UTC date components for correct comparison
        const purchaseDate = new Date(purchase.date);
        const { year: purchaseYear, month: purchaseMonth, day: purchaseDay } = extractDateComponents(purchaseDate);
        // Normalize to noon (12:00:00) for consistent date comparison
        const purchaseDateOnly = new Date(purchaseYear, purchaseMonth, purchaseDay, 12, 0, 0, 0);
        return purchaseDateOnly.getTime() === startOfDay.getTime();
      }
      // Check if any payment has a date matching the target date
      return payments.some((payment) => {
        if (!payment.date) {
          // If payment has no date, use purchase date
          // Database stores dates in UTC, so we extract UTC date components for correct comparison
          const purchaseDate = new Date(purchase.date);
          const { year: purchaseYear, month: purchaseMonth, day: purchaseDay } = extractDateComponents(purchaseDate);
          // Normalize to noon (12:00:00) for consistent date comparison
          const purchaseDateOnly = new Date(purchaseYear, purchaseMonth, purchaseDay, 12, 0, 0, 0);
          return purchaseDateOnly.getTime() === startOfDay.getTime();
        }
        const paymentDateOnly = parsePaymentDate(payment.date);
        if (!paymentDateOnly) return false;
        return paymentDateOnly.getTime() === startOfDay.getTime();
      });
    });

    // Expenses use the date field directly (not payment dates)
    // Normalize expense dates to noon for consistent comparison
    const expenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 0, 0, 0, 0),
          lte: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), 23, 59, 59, 999),
        },
      },
      orderBy: { createdAt: "asc" },
    });
    
    // Filter expenses by normalizing their dates to noon and comparing with startOfDay
    // Database stores dates in UTC, so we extract UTC date components for correct comparison
    const filteredExpenses = expenses.filter((expense) => {
      const expenseDate = new Date(expense.date);
      const { year: expenseYear, month: expenseMonth, day: expenseDay } = extractDateComponents(expenseDate);
      const expenseDateOnly = new Date(expenseYear, expenseMonth, expenseDay, 12, 0, 0, 0);
      return expenseDateOnly.getTime() === startOfDay.getTime();
    });

    // Extract opening balance additions from transactions
    // These are transactions with source "add_opening_balance" or containing "opening_balance" (but not the initial "opening_balance")
    const openingBalanceAdditions = transactions
      .filter((tx: any) => {
        // Include transactions that are opening balance additions (not the initial opening_balance)
        const isAddition = (tx.source === "add_opening_balance" || 
                           (tx.source && tx.source.includes("opening_balance") && tx.source !== "opening_balance"));
        if (!isAddition) return false;
        
        // IMPORTANT: Filter by date to ensure only additions for the selected date are included
        // Database stores dates in UTC, so we extract UTC date components for correct comparison
        const txDate = new Date(tx.date || tx.createdAt);
        const { year: txYear, month: txMonth, day: txDay } = extractDateComponents(txDate);
        const txDateOnly = new Date(txYear, txMonth, txDay, 12, 0, 0, 0);
        
        const reportYear = dateObj.getFullYear();
        const reportMonth = dateObj.getMonth();
        const reportDay = dateObj.getDate();
        const reportDateOnly = new Date(reportYear, reportMonth, reportDay, 12, 0, 0, 0);
        
        // Only include if transaction date matches report date
        return txDateOnly.getTime() === reportDateOnly.getTime();
      })
      .map((tx: any) => {
        // Use bankAccount from transaction if available, otherwise use bankMap
        const bankAccount = tx.bankAccount || (tx.bankAccountId ? bankMap.get(tx.bankAccountId) : null);
        return {
          id: tx.id,
          date: tx.date || tx.createdAt,
          createdAt: tx.createdAt,
          time: tx.createdAt || tx.date,
          amount: Number(tx.amount || 0),
          paymentType: tx.paymentType || "cash",
          bankAccountId: tx.bankAccountId,
          bankAccount: bankAccount,
          description: tx.description || "Opening Balance Addition",
          userName: tx.userName,
          source: tx.source,
          beforeBalance: tx.beforeBalance ? Number(tx.beforeBalance) : null,
          afterBalance: tx.afterBalance ? Number(tx.afterBalance) : null,
          changeAmount: tx.changeAmount ? Number(tx.changeAmount) : null,
          type: tx.type || "income",
        };
      });

    return {
      date,
      openingBalance: {
        cash: openingCash,
        banks: openingBankBalances.map((b) => ({
          ...b,
          bankName: bankMap.get(b.bankAccountId)?.bankName || "Unknown",
          accountNumber: bankMap.get(b.bankAccountId)?.accountNumber || "",
          balance: Number(b.balance || 0),
        })),
        total: openingCash + openingBankBalances.reduce((sum, b) => sum + Number(b.balance || 0), 0),
      },
      closingBalance: {
        cash: closingCash,
        banks: closingBankBalances,
        total: closingCash + closingBankBalances.reduce((sum, b) => sum + Number(b.balance || 0), 0),
      },
      openingBalanceAdditions, // Opening balance additions for this date
      steps, // Step-by-step transactions
      summary: {
      sales: {
          count: sales.length,
          // Calculate total from payments that occurred on this date
          total: sales.reduce((sum, s) => {
            const payments = (s.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
            if (payments.length === 0) {
            // No payments array, use total if sale date matches
            // Database stores dates in UTC, so we extract UTC date components for correct comparison
            const saleDate = new Date(s.date);
            const { year, month, day } = extractDateComponents(saleDate);
            const saleDateNormalized = new Date(year, month, day, 12, 0, 0, 0);
            return saleDateNormalized.getTime() === startOfDay.getTime() ? sum + Number(s.total || 0) : sum;
            }
            // Sum only payments that occurred on this date
            return sum + payments.reduce((paymentSum, payment) => {
              const paymentDateRaw = payment.date ? new Date(payment.date) : new Date(s.date);
              // Normalize to noon (12:00:00) for consistent date comparison
              const paymentDate = normalizeDateToNoon(paymentDateRaw);
              if (paymentDate.getTime() === startOfDay.getTime()) {
                return paymentSum + Number(payment.amount || 0);
              }
              return paymentSum;
            }, 0);
          }, 0),
      },
      purchases: {
          count: purchases.length,
          // Calculate total from payments that occurred on this date
          total: purchases.reduce((sum, p) => {
            const payments = (p.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
            if (payments.length === 0) {
              // No payments array, use total if purchase date matches
              const purchaseDate = new Date(p.date);
              purchaseDate.setHours(0, 0, 0, 0);
              return purchaseDate.getTime() === startOfDay.getTime() ? sum + Number(p.total || 0) : sum;
            }
            // Sum only payments that occurred on this date
            return sum + payments.reduce((paymentSum, payment) => {
              const paymentDateRaw = payment.date ? new Date(payment.date) : new Date(p.date);
              // Normalize to noon (12:00:00) for consistent date comparison
              const paymentDate = normalizeDateToNoon(paymentDateRaw);
              if (paymentDate.getTime() === startOfDay.getTime()) {
                return paymentSum + Number(payment.amount || 0);
              }
              return paymentSum;
            }, 0);
          }, 0),
      },
      expenses: {
        count: filteredExpenses.length,
          total: filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
        },
      },
      sales: {
        // Expand sales into payment rows - each payment becomes a separate row
        // Use a Set to track seen payment keys (sale.id + paymentIndex) to prevent duplicates
        items: (() => {
          const seenSalePayments = new Set<string>();
          return sales.flatMap((sale) => {
            const payments = (sale.payments as Array<{ type?: string; amount?: number; date?: string; cardId?: string; bankAccountId?: string }> | null) || [];
            if (payments.length === 0) {
              // If no payments array, create a single row from sale date
              // Database stores dates in UTC, so we extract UTC date components for correct comparison
              const saleDate = new Date(sale.date);
              const { year, month, day } = extractDateComponents(saleDate);
              // Normalize to noon (12:00:00) for consistent date comparison
              const saleDateNormalized = new Date(year, month, day, 12, 0, 0, 0);
              if (saleDateNormalized.getTime() === startOfDay.getTime()) {
                const paymentKey = `${sale.id}-0`;
                if (seenSalePayments.has(paymentKey)) {
                  return [];
                }
                seenSalePayments.add(paymentKey);
                return [{
                  ...sale,
                  paymentAmount: Number(sale.total || 0),
                  paymentDate: sale.date,
                  paymentType: sale.paymentType || "cash",
                  paymentIndex: 0,
                }];
              }
              return [];
            }
            // Create a row for each payment that matches the target date
            return payments
              .map((payment, index) => {
                // Create a more specific key that includes payment type and amount to prevent duplicates
                const paymentType = payment.type || sale.paymentType || "cash";
                const paymentAmount = Number(payment.amount || 0);
                const paymentKey = `${sale.id}-${index}-${paymentType}-${paymentAmount.toFixed(2)}`;
                // Skip if we've already seen this payment
                if (seenSalePayments.has(paymentKey)) {
                  return null;
                }
                
                const paymentDateOnly = payment.date ? parsePaymentDate(payment.date) : null;
                if (!paymentDateOnly) {
                  // Fallback to sale date
                  // Database stores dates in UTC, so we extract UTC date components for correct comparison
                  const saleDate = new Date(sale.date);
                  const { year, month, day } = extractDateComponents(saleDate);
                  // Normalize to noon (12:00:00) for consistent date comparison
                  const saleDateOnly = new Date(year, month, day, 12, 0, 0, 0);
                  if (saleDateOnly.getTime() === startOfDay.getTime()) {
                    seenSalePayments.add(paymentKey);
                    return {
                      ...sale,
                      paymentAmount: paymentAmount,
                      paymentDate: sale.date,
                      paymentType: paymentType,
                      paymentIndex: index,
                    };
                  }
                  return null;
                }
                if (paymentDateOnly.getTime() === startOfDay.getTime()) {
                  seenSalePayments.add(paymentKey);
                  return {
                    ...sale,
                    paymentAmount: paymentAmount,
                    paymentDate: payment.date || sale.date,
                    paymentType: paymentType,
                    paymentIndex: index,
                  };
                }
                return null;
              })
              .filter((row) => row !== null);
          });
        })(),
        total: sales.reduce((sum, s) => {
          const payments = (s.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
          if (payments.length === 0) {
            const saleDate = new Date(s.date);
            saleDate.setHours(0, 0, 0, 0);
            return saleDate.getTime() === startOfDay.getTime() ? sum + Number(s.total || 0) : sum;
          }
          return sum + payments.reduce((paymentSum, payment) => {
            const paymentDateOnly = payment.date ? parsePaymentDate(payment.date) : null;
            if (!paymentDateOnly) {
              const saleDate = new Date(s.date);
              const saleYear = saleDate.getFullYear();
              const saleMonth = saleDate.getMonth();
              const saleDay = saleDate.getDate();
              const saleDateOnly = new Date(saleYear, saleMonth, saleDay, 0, 0, 0, 0);
              if (saleDateOnly.getTime() === startOfDay.getTime()) {
                return paymentSum + Number(payment.amount || 0);
              }
              return paymentSum;
            }
            if (paymentDateOnly.getTime() === startOfDay.getTime()) {
              return paymentSum + Number(payment.amount || 0);
            }
            return paymentSum;
          }, 0);
        }, 0),
        cash: sales.reduce((sum, s) => {
          const payments = (s.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
          const cashPayments = payments.filter(p => p.type === "cash");
          if (cashPayments.length > 0) {
            return sum + cashPayments.reduce((paymentSum, payment) => {
              const paymentDateOnly = payment.date ? parsePaymentDate(payment.date) : null;
              if (!paymentDateOnly) {
                const saleDate = new Date(s.date);
                const saleYear = saleDate.getFullYear();
                const saleMonth = saleDate.getMonth();
                const saleDay = saleDate.getDate();
                const saleDateOnly = new Date(saleYear, saleMonth, saleDay, 0, 0, 0, 0);
                if (saleDateOnly.getTime() === startOfDay.getTime()) {
                  return paymentSum + Number(payment.amount || 0);
                }
                return paymentSum;
              }
              if (paymentDateOnly.getTime() === startOfDay.getTime()) {
                return paymentSum + Number(payment.amount || 0);
              }
              return paymentSum;
            }, 0);
          }
          if (payments.length === 0) {
            const saleDate = new Date(s.date);
            saleDate.setHours(0, 0, 0, 0);
            if (saleDate.getTime() === startOfDay.getTime()) {
              return sum + Number(s.total || 0);
            }
          }
          return sum;
        }, 0),
        bank_transfer: sales.reduce((sum, s) => {
          const payments = (s.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
          const bankPayments = payments.filter(p => p.type === "bank_transfer");
          return sum + bankPayments.reduce((paymentSum, payment) => {
            const paymentDateOnly = payment.date ? parsePaymentDate(payment.date) : null;
            if (!paymentDateOnly) {
              // Fallback to sale date
              const saleDate = new Date(s.date);
              const { year, month, day } = extractDateComponents(saleDate);
              // Normalize to noon (12:00:00) for consistent date comparison
              const saleDateOnly = new Date(year, month, day, 12, 0, 0, 0);
              if (saleDateOnly.getTime() === startOfDay.getTime()) {
                return paymentSum + Number(payment.amount || 0);
              }
              return paymentSum;
            }
            if (paymentDateOnly.getTime() === startOfDay.getTime()) {
              return paymentSum + Number(payment.amount || 0);
            }
            return paymentSum;
          }, 0);
        }, 0),
        card: sales.reduce((sum, s) => {
          const payments = (s.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
          const cardPayments = payments.filter(p => p.type === "card");
          return sum + cardPayments.reduce((paymentSum, payment) => {
            const paymentDate = payment.date ? new Date(payment.date) : new Date(s.date);
            paymentDate.setHours(0, 0, 0, 0);
            if (paymentDate.getTime() === startOfDay.getTime()) {
              return paymentSum + Number(payment.amount || 0);
            }
            return paymentSum;
          }, 0);
        }, 0),
      },
      purchases: {
        // Expand purchases into payment rows - each payment becomes a separate row
        // Use a Set to track seen payment keys (purchase.id + paymentIndex) to prevent duplicates
        items: (() => {
          const seenPurchasePayments = new Set<string>();
          return purchases.flatMap((purchase) => {
            const payments = (purchase.payments as Array<{ type?: string; amount?: number; date?: string; cardId?: string; bankAccountId?: string }> | null) || [];
            if (payments.length === 0) {
              // If no payments array, create a single row from purchase date
              // Normalize to noon (12:00:00) for consistent date comparison
              const purchaseDate = normalizeDateToNoon(new Date(purchase.date));
              if (purchaseDate.getTime() === startOfDay.getTime()) {
                const paymentKey = `${purchase.id}-0`;
                if (seenPurchasePayments.has(paymentKey)) {
                  return [];
                }
                seenPurchasePayments.add(paymentKey);
                return [{
                  ...purchase,
                  paymentAmount: Number(purchase.total || 0),
                  paymentDate: purchase.date,
                  paymentType: "cash",
                  paymentIndex: 0,
                }];
              }
              return [];
            }
            // Create a row for each payment that matches the target date
            return payments
              .map((payment, index) => {
                // Create a more specific key that includes payment type and amount to prevent duplicates
                const paymentType = payment.type || "cash";
                const paymentAmount = Number(payment.amount || 0);
                const paymentKey = `${purchase.id}-${index}-${paymentType}-${paymentAmount.toFixed(2)}`;
                // Skip if we've already seen this payment
                if (seenPurchasePayments.has(paymentKey)) {
                  return null;
                }
                
                const paymentDateOnly = payment.date ? parsePaymentDate(payment.date) : null;
                if (!paymentDateOnly) {
                  // Fallback to purchase date
                  // Normalize to noon (12:00:00) for consistent date comparison
                  const purchaseDateOnly = normalizeDateToNoon(new Date(purchase.date));
                  if (purchaseDateOnly.getTime() === startOfDay.getTime()) {
                    seenPurchasePayments.add(paymentKey);
                    return {
                      ...purchase,
                      paymentAmount: paymentAmount,
                      paymentDate: purchase.date,
                      paymentType: paymentType,
                      paymentIndex: index,
                    };
                  }
                  return null;
                }
                if (paymentDateOnly.getTime() === startOfDay.getTime()) {
                  seenPurchasePayments.add(paymentKey);
                  return {
                    ...purchase,
                    paymentAmount: paymentAmount,
                    paymentDate: payment.date || purchase.date,
                    paymentType: paymentType,
                    paymentIndex: index,
                  };
                }
                return null;
              })
              .filter((row) => row !== null);
          });
        })(),
        total: purchases.reduce((sum, p) => {
          const payments = (p.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
          if (payments.length === 0) {
            // Normalize to noon (12:00:00) for consistent date comparison
            const purchaseDate = normalizeDateToNoon(new Date(p.date));
            return purchaseDate.getTime() === startOfDay.getTime() ? sum + Number(p.total || 0) : sum;
          }
          return sum + payments.reduce((paymentSum, payment) => {
            const paymentDateOnly = payment.date ? parsePaymentDate(payment.date) : null;
            if (!paymentDateOnly) {
              // Fallback to purchase date
              const purchaseDate = normalizeDateToNoon(new Date(p.date));
              if (purchaseDate.getTime() === startOfDay.getTime()) {
                return paymentSum + Number(payment.amount || 0);
              }
              return paymentSum;
            }
            if (paymentDateOnly.getTime() === startOfDay.getTime()) {
              return paymentSum + Number(payment.amount || 0);
            }
            return paymentSum;
          }, 0);
        }, 0),
        cash: purchases.reduce((sum, p) => {
          const payments = (p.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
          const cashPayments = payments.filter(pay => pay.type === "cash");
          return sum + cashPayments.reduce((paymentSum, payment) => {
            const paymentDateOnly = payment.date ? parsePaymentDate(payment.date) : null;
            if (!paymentDateOnly) {
              // Fallback to purchase date
              const purchaseDate = normalizeDateToNoon(new Date(p.date));
              if (purchaseDate.getTime() === startOfDay.getTime()) {
                return paymentSum + Number(payment.amount || 0);
              }
              return paymentSum;
            }
            if (paymentDateOnly.getTime() === startOfDay.getTime()) {
              return paymentSum + Number(payment.amount || 0);
            }
            return paymentSum;
          }, 0);
        }, 0),
        bank_transfer: purchases.reduce((sum, p) => {
          const payments = (p.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
          const bankPayments = payments.filter(pay => pay.type === "bank_transfer");
          return sum + bankPayments.reduce((paymentSum, payment) => {
            const paymentDateOnly = payment.date ? parsePaymentDate(payment.date) : null;
            if (!paymentDateOnly) {
              // Fallback to purchase date
              const purchaseDate = normalizeDateToNoon(new Date(p.date));
              if (purchaseDate.getTime() === startOfDay.getTime()) {
                return paymentSum + Number(payment.amount || 0);
              }
              return paymentSum;
            }
            if (paymentDateOnly.getTime() === startOfDay.getTime()) {
              return paymentSum + Number(payment.amount || 0);
            }
            return paymentSum;
          }, 0);
        }, 0),
        card: purchases.reduce((sum, p) => {
          const payments = (p.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
          const cardPayments = payments.filter(pay => pay.type === "card");
          return sum + cardPayments.reduce((paymentSum, payment) => {
            const paymentDate = payment.date ? new Date(payment.date) : new Date(p.date);
            paymentDate.setHours(0, 0, 0, 0);
            if (paymentDate.getTime() === startOfDay.getTime()) {
              return paymentSum + Number(payment.amount || 0);
            }
            return paymentSum;
          }, 0);
        }, 0),
      },
      expenses: {
        items: filteredExpenses,
        total: filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
        cash: filteredExpenses.filter(e => e.paymentType === "cash").reduce((sum, e) => sum + Number(e.amount || 0), 0),
        bank_transfer: filteredExpenses.filter(e => e.paymentType === "bank_transfer").reduce((sum, e) => sum + Number(e.amount || 0), 0),
        card: 0, // Expenses don't use card payments
      },
    };
  }

  /**
   * Get monthly report - aggregates daily reports for the month
   */
  async getMonthlyReport(year: number, month: number) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    
    return this.getDateRangeReport(formatLocalYMD(startDate), formatLocalYMD(endDate));
  }

  /**
   * Get comprehensive date range report with step-by-step calculations
   */
  async getDateRangeReport(startDate: string, endDate: string) {
    const start = parseLocalYMD(startDate);
    // Use noon (12:00:00) for date comparisons to avoid timezone conversion issues
    start.setHours(12, 0, 0, 0); // Use noon instead of midnight
    const end = parseLocalYMD(endDate);
    // When startDate === endDate, set end to end of day to capture all transactions for that day
    if (startDate === endDate) {
      end.setHours(23, 59, 59, 999); // End of day for single day reports
    } else {
      end.setHours(12, 59, 59, 999); // Use 12:59:59 for date range comparisons
    }

    // IMPORTANT: Opening Balance = Previous day's closing balance (baseline only)
    // It should NOT include manual additions made during the date range
    // Always use previous day's closing balance, not the openingBalance record (which might have additions)
    const previousClosing = await dailyClosingBalanceService.getPreviousDayClosingBalance(startDate);
    
    let openingBalance: any;
    if (previousClosing) {
      // Use previous day's closing as opening balance for start date (baseline)
      openingBalance = {
        id: `opening-${startDate}`,
        date: start,
        cashBalance: previousClosing.cashBalance,
        bankBalances: previousClosing.bankBalances as any,
        cardBalances: previousClosing.cardBalances as any,
        notes: "Previous day's closing balance (baseline)",
        userId: null,
        userName: "System",
        createdAt: start,
        updatedAt: start,
        createdBy: null,
        createdByType: null,
        updatedBy: null,
        updatedByType: null,
      };
    } else {
      openingBalance = {
        id: `zero-${startDate}`,
        date: start,
        cashBalance: 0,
        bankBalances: [],
        cardBalances: [],
        notes: "No previous balance found",
        userId: null,
        userName: "System",
        createdAt: start,
        updatedAt: start,
        createdBy: null,
        createdByType: null,
        updatedBy: null,
        updatedByType: null,
      };
    }

    // Get all balance transactions for the date range, sorted by createdAt (ASC)
    const transactions = await balanceTransactionService.getTransactions({
      startDate,
      endDate,
    });

    // Log refund transactions for debugging
    const refundTransactions = transactions.filter((tx: any) => tx.source === "sale_refund" || tx.source === "purchase_refund");
    if (refundTransactions.length > 0) {
      logger.info(`Found ${refundTransactions.length} refund transactions in date range ${startDate} to ${endDate}`);
      refundTransactions.forEach((tx: any) => {
        logger.info(`Refund transaction: ${tx.source}, id=${tx.id}, date=${tx.date}, createdAt=${tx.createdAt}, amount=${tx.amount}`);
      });
    }

    transactions.sort((a: any, b: any) => {
      const aTime = new Date(a.createdAt || a.date).getTime();
      const bTime = new Date(b.createdAt || b.date).getTime();
      return aTime - bTime;
    });

    // Get bank accounts
    const banks = await prisma.bankAccount.findMany({ where: { isActive: true } });
    const bankMap = new Map(banks.map((b) => [b.id, b]));

    // Build step-by-step transaction list
    const steps: any[] = [];
    
    const openingCash = Number(openingBalance.cashBalance || 0);
    const openingBankBalances = (openingBalance.bankBalances as Array<{ bankAccountId: string; balance: number }>) || [];
    
    let runningCash = openingCash;
    const runningBankBalances = new Map<string, number>();
    openingBankBalances.forEach((b) => {
      runningBankBalances.set(b.bankAccountId, Number(b.balance || 0));
    });

    // Add opening balance step
    steps.push({
      step: 1,
      type: "Opening Balance",
      datetime: start,
      cashBefore: openingCash,
      cashAfter: openingCash,
      cashChange: 0,
      bankBalancesBefore: openingBankBalances.map((b) => ({
        bankAccountId: b.bankAccountId,
        bankName: bankMap.get(b.bankAccountId)?.bankName || "Unknown",
        accountNumber: bankMap.get(b.bankAccountId)?.accountNumber || "",
        balance: Number(b.balance || 0),
      })),
      bankBalancesAfter: openingBankBalances.map((b) => ({
        bankAccountId: b.bankAccountId,
        bankName: bankMap.get(b.bankAccountId)?.bankName || "Unknown",
        accountNumber: bankMap.get(b.bankAccountId)?.accountNumber || "",
        balance: Number(b.balance || 0),
      })),
      description: "Opening Balance",
      source: "Opening Balance",
    });

    // Process transactions
    let stepNumber = 2;
    for (const tx of transactions) {
      // IMPORTANT: Skip 'opening_balance' transactions to avoid double counting
      // The opening balance is already set from previous day's closing balance
      // These transactions represent the initial baseline setting and should not be processed again
      if (tx.source === "opening_balance") {
        logger.info(`Skipping opening_balance transaction in date range report: ${tx.id}, amount=${tx.amount}`);
        continue;
      }

      // IMPORTANT: Filter transactions by actual date to ensure only transactions within the date range are included
      // For all transactions (sales, purchases, refunds), use createdAt as it represents when the transaction actually occurred
      // This ensures consistency with how getTransactions fetches them
      // Database stores dates in UTC, so we extract UTC date components for correct comparison
      let txDate: Date;
      // Use createdAt for all transactions to ensure consistency with getTransactions query
      // createdAt represents when the transaction actually occurred, which is more reliable than the date field
      if (tx.createdAt) {
        txDate = new Date(tx.createdAt);
      } else {
        // Fallback to date field if createdAt is not available
        txDate = new Date(tx.date);
      }
      const { year, month, day } = extractDateComponents(txDate);
      const txDateOnly = new Date(year, month, day, 12, 0, 0, 0);
      
      // Skip transactions that are outside the date range
      if (txDateOnly.getTime() < start.getTime() || txDateOnly.getTime() > end.getTime()) {
        logger.info(`Skipping transaction ${tx.id} (${tx.source}) - outside date range: txDate=${txDateOnly.toISOString().split('T')[0]}, range=${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`);
        continue;
      }

      const paymentType = tx.paymentType || "cash";
      const amount = Number(tx.amount || 0);
      const type = tx.type || "income";

      let txType = "Transaction";
      let description = tx.description || "";
      
      if (tx.source === "sale" || tx.source === "sale_payment") {
        txType = "Sale";
        const sale = await prisma.sale.findUnique({ where: { id: tx.sourceId || "" }, include: { customer: true } }).catch((): null => null);
        if (sale) {
          description = `Sale - Bill #${sale.billNumber}${sale.customerName ? ` - ${sale.customerName}` : ""}`;
        }
      } else if (tx.source === "sale_refund") {
        txType = "Sale Refund";
        const sale = await prisma.sale.findUnique({ where: { id: tx.sourceId || "" }, include: { customer: true } }).catch((): null => null);
        if (sale) {
          description = `Sale Refund - Bill #${sale.billNumber}${sale.customerName ? ` - ${sale.customerName}` : ""}`;
        } else {
          description = tx.description || "Sale Refund";
        }
      } else if (tx.source === "purchase" || tx.source === "purchase_payment") {
        txType = "Purchase";
        const purchase = await prisma.purchase.findUnique({ where: { id: tx.sourceId || "" }, include: { supplier: true } }).catch((): null => null);
        if (purchase) {
          description = `Purchase - ${purchase.supplierName || "N/A"}`;
        }
      } else if (tx.source === "purchase_refund") {
        txType = "Purchase Refund";
        const purchase = await prisma.purchase.findUnique({ where: { id: tx.sourceId || "" }, include: { supplier: true } }).catch((): null => null);
        if (purchase) {
          description = `Purchase Refund - ${purchase.supplierName || "N/A"}`;
        } else {
          description = tx.description || "Purchase Refund";
        }
      } else if (tx.source === "expense") {
        txType = "Expense";
        const expense = await prisma.expense.findUnique({ where: { id: tx.sourceId || "" } }).catch((): null => null);
        if (expense) {
          description = `Expense - ${expense.category}${expense.description ? `: ${expense.description}` : ""}`;
        }
      } else if (tx.source?.includes("opening_balance") || tx.source === "add_opening_balance") {
        txType = "Opening Balance Addition";
        description = tx.description || "Opening Balance Addition";
      }

      const cashBefore = runningCash;
      const bankBalancesBefore = Array.from(runningBankBalances.entries()).map(([id, balance]) => ({
        bankAccountId: id,
        bankName: bankMap.get(id)?.bankName || "Unknown",
        accountNumber: bankMap.get(id)?.accountNumber || "",
        balance,
      }));

      if (paymentType === "cash") {
        if (type === "income") {
          runningCash += amount;
        } else {
          runningCash -= amount;
        }
      } else if (paymentType === "bank_transfer" && tx.bankAccountId) {
        const current = runningBankBalances.get(tx.bankAccountId) || 0;
        if (type === "income") {
          runningBankBalances.set(tx.bankAccountId, current + amount);
        } else {
          runningBankBalances.set(tx.bankAccountId, current - amount);
        }
      }

      const cashAfter = runningCash;
      const bankBalancesAfter = Array.from(runningBankBalances.entries()).map(([id, balance]) => ({
        bankAccountId: id,
        bankName: bankMap.get(id)?.bankName || "Unknown",
        accountNumber: bankMap.get(id)?.accountNumber || "",
        balance,
      }));

      // Use createdAt for actual datetime (has real time when transaction was created)
      // createdAt is a proper Date object with time information
      // When serialized to JSON, it will be sent as ISO string and frontend will parse it correctly
      const transactionDateTime = new Date(tx.createdAt);

      steps.push({
        step: stepNumber++,
        type: txType,
        transactionType: type, // "income" or "expense"
        datetime: transactionDateTime,
        paymentType,
        amount,
        cashBefore,
        cashAfter,
        cashChange: type === "income" ? amount : -amount,
        bankAccountId: tx.bankAccountId,
        bankName: tx.bankAccountId ? bankMap.get(tx.bankAccountId)?.bankName : null,
        bankBalancesBefore,
        bankBalancesAfter,
        description,
        source: tx.source || "unknown",
        sourceId: tx.sourceId,
        userName: tx.userName,
      });
    }

    // IMPORTANT: Also add payments directly from sales and purchases that might not have BalanceTransactions
    // or whose BalanceTransactions might have been filtered out
    // Fetch all sales and purchases that might have payments in the date range
    const allSalesForPayments = await prisma.sale.findMany({
      where: {
        createdAt: { gte: new Date(start.getTime() - 30 * 24 * 60 * 60 * 1000) }, // 30 days before start
      },
      include: { customer: true },
      orderBy: { createdAt: "asc" },
    });

    const allPurchasesForPayments = await prisma.purchase.findMany({
      where: {
        createdAt: { gte: new Date(start.getTime() - 30 * 24 * 60 * 60 * 1000) }, // 30 days before start
      },
      include: { supplier: true },
      orderBy: { createdAt: "asc" },
    });

    // Track which transactions we've already added from BalanceTransactions
    // Use a combination of source, sourceId, amount, date, and payment index to identify unique payments
    // Include payment index to handle multiple payments with same amount/date
    const addedTransactionKeys = new Set<string>();
    const paymentIndexMap = new Map<string, number>(); // Track payment index per purchase/sale
    
    // Track transactions by sourceId to count payment indices
    const transactionCounts = new Map<string, number>();
    
    transactions.forEach((tx: any) => {
      if (tx.source === "sale_payment" || tx.source === "purchase_payment") {
        const txDate = new Date(tx.date || tx.createdAt);
        const { year, month, day } = extractDateComponents(txDate);
        const dateStr = `${year}-${month}-${day}`;
        const baseKey = `${tx.source}-${tx.sourceId || ""}`;
        // Count how many transactions we've seen for this purchase/sale
        const count = transactionCounts.get(baseKey) || 0;
        transactionCounts.set(baseKey, count + 1);
        // Include payment index in key to handle multiple payments with same amount/date
        // Use count as index (0-based)
        const key = `${tx.source}-${tx.sourceId || ""}-${Number(tx.amount || 0).toFixed(2)}-${dateStr}-${count}`;
        addedTransactionKeys.add(key);
      }
    });

    // Add sale payments that aren't already in BalanceTransactions
    for (const sale of allSalesForPayments) {
      const payments = (sale.payments as Array<{ type?: string; amount?: number; date?: string; cardId?: string; bankAccountId?: string }> | null) || [];
      for (let paymentIndex = 0; paymentIndex < payments.length; paymentIndex++) {
        const payment = payments[paymentIndex];
        if (!payment.amount || payment.amount <= 0) continue;

        const paymentDateOnly = payment.date ? parsePaymentDate(payment.date) : null;
        let paymentDateTime: Date;
        if (paymentDateOnly) {
          // Use payment date if available
          paymentDateTime = payment.date ? new Date(payment.date) : new Date(sale.date);
        } else {
          // Fallback to sale date
          paymentDateTime = new Date(sale.date);
        }

        // Check if payment is in date range
        const { year, month, day } = extractDateComponents(paymentDateTime);
        const paymentDateOnlyForCheck = new Date(year, month, day, 12, 0, 0, 0);
        if (paymentDateOnlyForCheck.getTime() < start.getTime() || paymentDateOnlyForCheck.getTime() > end.getTime()) {
          continue;
        }

        // Check if we already added this from BalanceTransactions
        // Use amount, date, and payment index to match with BalanceTransaction
        const dateStr = `${year}-${month}-${day}`;
        const amount = Number(payment.amount || 0);
        
        // Count how many payments have the same amount and date
        const paymentsWithSameAmountDate = payments.filter((p: any, pIdx: number) => {
          const pDate = p.date ? parsePaymentDate(p.date) : null;
          let pDateStr: string;
          if (!pDate) {
            const saleDate = new Date(sale.date);
            const { year: pYear, month: pMonth, day: pDay } = extractDateComponents(saleDate);
            pDateStr = `${pYear}-${pMonth}-${pDay}`;
          } else {
            const { year: pYear, month: pMonth, day: pDay } = extractDateComponents(pDate);
            pDateStr = `${pYear}-${pMonth}-${pDay}`;
          }
          return pDateStr === dateStr && Number(p.amount || 0).toFixed(2) === amount.toFixed(2);
        });
        
        // Check if this exact payment index was already added
        const exactKey = `sale_payment-${sale.id}-${amount.toFixed(2)}-${dateStr}-${paymentIndex}`;
        if (addedTransactionKeys.has(exactKey)) {
          continue; // This exact payment was already added
        }
        
        // If there are multiple payments with same amount/date, don't skip based on generic match
        // Only skip if this is the ONLY payment with this amount/date AND it was already added
        if (paymentsWithSameAmountDate.length === 1) {
          // This is the only payment with this amount/date, check if it was added (any index)
          let foundMatch = false;
          for (let idx = 0; idx < payments.length; idx++) {
            const transactionKey = `sale_payment-${sale.id}-${amount.toFixed(2)}-${dateStr}-${idx}`;
            if (addedTransactionKeys.has(transactionKey)) {
              foundMatch = true;
              break;
            }
          }
          if (foundMatch) {
            continue;
          }
        }
        // If multiple payments have same amount/date, add all of them (don't skip)

        // Only add if payment type is cash, bank_transfer, or card (not credit)
        const paymentType = payment.type || sale.paymentType || "cash";
        if (paymentType === "credit") continue;
        const type = "income";

        // Update running balances
        const cashBefore = runningCash;
        const bankBalancesBefore = Array.from(runningBankBalances.entries()).map(([id, balance]) => ({
          bankAccountId: id,
          bankName: bankMap.get(id)?.bankName || "Unknown",
          accountNumber: bankMap.get(id)?.accountNumber || "",
          balance,
        }));

        if (paymentType === "cash") {
          runningCash += amount;
        } else if (paymentType === "bank_transfer" && (payment.bankAccountId || sale.bankAccountId)) {
          const bankAccountId = payment.bankAccountId || sale.bankAccountId;
          if (bankAccountId) {
            const current = runningBankBalances.get(bankAccountId) || 0;
            runningBankBalances.set(bankAccountId, current + amount);
          }
        } else if (paymentType === "card" && (payment.cardId || sale.cardId)) {
          const cardId = payment.cardId || sale.cardId;
          if (cardId) {
            // Cards use bankAccountId field in BalanceTransaction
            const current = runningBankBalances.get(cardId) || 0;
            runningBankBalances.set(cardId, current + amount);
          }
        }

        const cashAfter = runningCash;
        const bankBalancesAfter = Array.from(runningBankBalances.entries()).map(([id, balance]) => ({
          bankAccountId: id,
          bankName: bankMap.get(id)?.bankName || "Unknown",
          accountNumber: bankMap.get(id)?.accountNumber || "",
          balance,
        }));

        steps.push({
          step: stepNumber++,
          type: "Sale",
          transactionType: type,
          datetime: paymentDateTime,
          paymentType,
          amount,
          cashBefore,
          cashAfter,
          cashChange: amount,
          bankAccountId: payment.bankAccountId || sale.bankAccountId || payment.cardId || sale.cardId,
          bankName: (payment.bankAccountId || sale.bankAccountId) ? bankMap.get(payment.bankAccountId || sale.bankAccountId || "")?.bankName : null,
          bankBalancesBefore,
          bankBalancesAfter,
          description: `Sale - Bill #${sale.billNumber}${sale.customerName ? ` - ${sale.customerName}` : ""}`,
          source: "sale_payment",
          sourceId: sale.id,
          userName: sale.userName || "System",
        });
      }
    }

    // Add purchase payments that aren't already in BalanceTransactions
    for (const purchase of allPurchasesForPayments) {
      const payments = (purchase.payments as Array<{ type?: string; amount?: number; date?: string; cardId?: string; bankAccountId?: string }> | null) || [];
      for (let paymentIndex = 0; paymentIndex < payments.length; paymentIndex++) {
        const payment = payments[paymentIndex];
        if (!payment.amount || payment.amount <= 0) continue;

        const paymentDateOnly = payment.date ? parsePaymentDate(payment.date) : null;
        let paymentDateTime: Date;
        if (paymentDateOnly) {
          // Use payment date if available
          paymentDateTime = payment.date ? new Date(payment.date) : new Date(purchase.date);
        } else {
          // Fallback to purchase date
          paymentDateTime = new Date(purchase.date);
        }

        // Check if payment is in date range
        const { year, month, day } = extractDateComponents(paymentDateTime);
        const paymentDateOnlyForCheck = new Date(year, month, day, 12, 0, 0, 0);
        if (paymentDateOnlyForCheck.getTime() < start.getTime() || paymentDateOnlyForCheck.getTime() > end.getTime()) {
          continue;
        }

        // Check if we already added this from BalanceTransactions
        // Use amount, date, and payment index to match with BalanceTransaction
        const dateStr = `${year}-${month}-${day}`;
        const amount = Number(payment.amount || 0);
        
        // Count how many payments have the same amount and date
        const paymentsWithSameAmountDate = payments.filter((p: any, pIdx: number) => {
          const pDate = p.date ? parsePaymentDate(p.date) : null;
          let pDateStr: string;
          if (!pDate) {
            const purchaseDate = new Date(purchase.date);
            const { year: pYear, month: pMonth, day: pDay } = extractDateComponents(purchaseDate);
            pDateStr = `${pYear}-${pMonth}-${pDay}`;
          } else {
            const { year: pYear, month: pMonth, day: pDay } = extractDateComponents(pDate);
            pDateStr = `${pYear}-${pMonth}-${pDay}`;
          }
          return pDateStr === dateStr && Number(p.amount || 0).toFixed(2) === amount.toFixed(2);
        });
        
        // Check if this exact payment index was already added
        const exactKey = `purchase_payment-${purchase.id}-${amount.toFixed(2)}-${dateStr}-${paymentIndex}`;
        if (addedTransactionKeys.has(exactKey)) {
          continue; // This exact payment was already added
        }
        
        // If there are multiple payments with same amount/date, don't skip based on generic match
        // Only skip if this is the ONLY payment with this amount/date AND it was already added
        if (paymentsWithSameAmountDate.length === 1) {
          // This is the only payment with this amount/date, check if it was added (any index)
          let foundMatch = false;
          for (let idx = 0; idx < payments.length; idx++) {
            const transactionKey = `purchase_payment-${purchase.id}-${amount.toFixed(2)}-${dateStr}-${idx}`;
            if (addedTransactionKeys.has(transactionKey)) {
              foundMatch = true;
              break;
            }
          }
          if (foundMatch) {
            continue;
          }
        }
        // If multiple payments have same amount/date, add all of them (don't skip)

        const paymentType = payment.type || "cash";
        const type = "expense";

        // Update running balances
        const cashBefore = runningCash;
        const bankBalancesBefore = Array.from(runningBankBalances.entries()).map(([id, balance]) => ({
          bankAccountId: id,
          bankName: bankMap.get(id)?.bankName || "Unknown",
          accountNumber: bankMap.get(id)?.accountNumber || "",
          balance,
        }));

        if (paymentType === "cash") {
          runningCash -= amount;
        } else if (paymentType === "bank_transfer" && payment.bankAccountId) {
          const current = runningBankBalances.get(payment.bankAccountId) || 0;
          runningBankBalances.set(payment.bankAccountId, current - amount);
        } else if (paymentType === "card" && (payment.cardId || payment.bankAccountId)) {
          const cardId = payment.cardId || payment.bankAccountId;
          if (cardId) {
            const current = runningBankBalances.get(cardId) || 0;
            runningBankBalances.set(cardId, current - amount);
          }
        }

        const cashAfter = runningCash;
        const bankBalancesAfter = Array.from(runningBankBalances.entries()).map(([id, balance]) => ({
          bankAccountId: id,
          bankName: bankMap.get(id)?.bankName || "Unknown",
          accountNumber: bankMap.get(id)?.accountNumber || "",
          balance,
        }));

        steps.push({
          step: stepNumber++,
          type: "Purchase",
          transactionType: type,
          datetime: paymentDateTime,
          paymentType,
          amount,
          cashBefore,
          cashAfter,
          cashChange: -amount,
          bankAccountId: payment.bankAccountId || payment.cardId,
          bankName: payment.bankAccountId ? bankMap.get(payment.bankAccountId)?.bankName : null,
          bankBalancesBefore,
          bankBalancesAfter,
          description: `Purchase - ${purchase.supplierName || "N/A"}`,
          source: "purchase_payment",
          sourceId: purchase.id,
          userName: purchase.userName || "System",
        });
      }
    }

    // Re-sort steps by datetime after adding payments
    steps.sort((a, b) => {
      const aTime = new Date(a.datetime).getTime();
      const bTime = new Date(b.datetime).getTime();
      return aTime - bTime;
    });

    // Re-number steps after sorting
    steps.forEach((step, index) => {
      step.step = index + 1;
    });

    // Calculate closing balance
    // First, try to get the stored closing balance for the end date (most accurate)
    // This ensures refunds and all transactions are included
    let closingCash = runningCash;
    let closingBankBalances = Array.from(runningBankBalances.entries()).map(([id, balance]) => ({
      bankAccountId: id,
      bankName: bankMap.get(id)?.bankName || "Unknown",
      accountNumber: bankMap.get(id)?.accountNumber || "",
      balance,
    }));

    // Try to get stored closing balance for end date (more accurate, includes all transactions)
    try {
      const storedClosingBalance = await dailyClosingBalanceService.getClosingBalance(endDate);
      if (storedClosingBalance) {
        // Use stored closing balance as it's more accurate (includes all transactions including refunds)
        closingCash = Number(storedClosingBalance.cashBalance || 0);
        const storedBanks = (storedClosingBalance.bankBalances as Array<{ bankAccountId: string; balance: number }>) || [];
        closingBankBalances = storedBanks.map((b) => ({
          bankAccountId: b.bankAccountId,
          bankName: bankMap.get(b.bankAccountId)?.bankName || "Unknown",
          accountNumber: bankMap.get(b.bankAccountId)?.accountNumber || "",
          balance: Number(b.balance || 0),
        }));
        logger.info(`Using stored closing balance for ${endDate}: cash=${closingCash}`);
      } else {
        logger.info(`No stored closing balance found for ${endDate}, using calculated balance: cash=${closingCash}`);
      }
    } catch (error: any) {
      logger.warn(`Error fetching stored closing balance for ${endDate}, using calculated balance: ${error.message}`);
      // Continue with calculated balance if stored balance fetch fails
    }

    // IMPORTANT: For Sales and Purchases, filter by PAYMENT DATES, not sale/purchase dates
    // Fetch all sales and purchases that might have payments in the date range
    const allSalesForRange = await prisma.sale.findMany({
      where: {
        createdAt: { gte: new Date(start.getTime() - 30 * 24 * 60 * 60 * 1000) }, // 30 days before start
      },
      include: { customer: true },
      orderBy: { createdAt: "asc" },
    });

    const allPurchasesForRange = await prisma.purchase.findMany({
      where: {
        createdAt: { gte: new Date(start.getTime() - 30 * 24 * 60 * 60 * 1000) }, // 30 days before start
      },
      include: { supplier: true },
      orderBy: { createdAt: "asc" },
    });

    // Filter sales by payment dates within the range
    const sales = allSalesForRange.filter((sale) => {
      const payments = (sale.payments as Array<{ type?: string; amount?: number; date?: string; cardId?: string; bankAccountId?: string }> | null) || [];
      if (payments.length === 0) {
        // If no payments array, check if sale date is in range
        // Database stores dates in UTC, so we extract UTC date components for correct comparison
        const saleDate = new Date(sale.date);
        const { year, month, day } = extractDateComponents(saleDate);
        // Normalize to noon (12:00:00) for consistent date comparison
        const saleDateOnly = new Date(year, month, day, 12, 0, 0, 0);
        return saleDateOnly.getTime() >= start.getTime() && saleDateOnly.getTime() <= end.getTime();
      }
      // Check if any payment has a date within the range
      return payments.some((payment) => {
        const paymentDateOnly = payment.date ? parsePaymentDate(payment.date) : null;
        if (!paymentDateOnly) {
          // Fallback to sale date
          // Database stores dates in UTC, so we extract UTC date components for correct comparison
          const saleDate = new Date(sale.date);
          const { year, month, day } = extractDateComponents(saleDate);
          const saleDateOnly = new Date(year, month, day, 12, 0, 0, 0);
          return saleDateOnly.getTime() >= start.getTime() && saleDateOnly.getTime() <= end.getTime();
        }
        return paymentDateOnly.getTime() >= start.getTime() && paymentDateOnly.getTime() <= end.getTime();
      });
    });

    // Filter purchases by payment dates within the range
    const purchases = allPurchasesForRange.filter((purchase) => {
      const payments = (purchase.payments as Array<{ type?: string; amount?: number; date?: string; cardId?: string; bankAccountId?: string }> | null) || [];
      if (payments.length === 0) {
        // If no payments array, check if purchase date is in range
        // Database stores dates in UTC, so we extract UTC date components for correct comparison
        const purchaseDate = new Date(purchase.date);
        const { year, month, day } = extractDateComponents(purchaseDate);
        // Normalize to noon (12:00:00) for consistent date comparison
        const purchaseDateOnly = new Date(year, month, day, 12, 0, 0, 0);
        return purchaseDateOnly.getTime() >= start.getTime() && purchaseDateOnly.getTime() <= end.getTime();
      }
      // Check if any payment has a date within the range
      return payments.some((payment) => {
        const paymentDateOnly = payment.date ? parsePaymentDate(payment.date) : null;
        if (!paymentDateOnly) {
                // Database stores dates in UTC, so we extract UTC date components for correct comparison
                const purchaseDate = new Date(purchase.date);
                const { year: purchaseYear, month: purchaseMonth, day: purchaseDay } = extractDateComponents(purchaseDate);
                const purchaseDateOnly = new Date(purchaseYear, purchaseMonth, purchaseDay, 12, 0, 0, 0);
                return purchaseDateOnly.getTime() >= start.getTime() && purchaseDateOnly.getTime() <= end.getTime();
        }
        return paymentDateOnly.getTime() >= start.getTime() && paymentDateOnly.getTime() <= end.getTime();
      });
    });

    // Expenses use the date field directly (not payment dates)
    // Normalize expense dates to noon for consistent comparison
    const allExpenses = await prisma.expense.findMany({
      orderBy: { createdAt: "asc" },
    });
    
    // Filter expenses by normalizing their dates to noon and comparing with date range
    // Database stores dates in UTC, so we extract UTC date components for correct comparison
    const expenses = allExpenses.filter((expense) => {
      const expenseDate = new Date(expense.date);
      const { year: expenseYear, month: expenseMonth, day: expenseDay } = extractDateComponents(expenseDate);
      const expenseDateOnly = new Date(expenseYear, expenseMonth, expenseDay, 12, 0, 0, 0);
      return expenseDateOnly.getTime() >= start.getTime() && expenseDateOnly.getTime() <= end.getTime();
    });

    // Extract opening balance additions from transactions for the date range
    const openingBalanceAdditions = transactions
      .filter((tx: any) => {
        // Include transactions that are opening balance additions (not the initial opening_balance)
        const isAddition = (tx.source === "add_opening_balance" || 
                           (tx.source && tx.source.includes("opening_balance") && tx.source !== "opening_balance"));
        if (!isAddition) return false;
        
        // Check if transaction date is within the range
        // Database stores dates in UTC, so we extract UTC date components for correct comparison
        const txDate = new Date(tx.date || tx.createdAt);
        const { year, month, day } = extractDateComponents(txDate);
        const txDateOnly = new Date(year, month, day, 12, 0, 0, 0);
        return txDateOnly.getTime() >= start.getTime() && txDateOnly.getTime() <= end.getTime();
      })
      .map((tx: any) => {
        // Use bankAccount from transaction if available, otherwise use bankMap
        const bankAccount = tx.bankAccount || (tx.bankAccountId ? bankMap.get(tx.bankAccountId) : null);
        return {
          id: tx.id,
          date: tx.date || tx.createdAt,
          createdAt: tx.createdAt,
          time: tx.createdAt || tx.date,
          amount: Number(tx.amount || 0),
          paymentType: tx.paymentType || "cash",
          bankAccountId: tx.bankAccountId,
          bankAccount: bankAccount,
          description: tx.description || "Opening Balance Addition",
          userName: tx.userName,
          source: tx.source,
          beforeBalance: tx.beforeBalance ? Number(tx.beforeBalance) : null,
          afterBalance: tx.afterBalance ? Number(tx.afterBalance) : null,
          changeAmount: tx.changeAmount ? Number(tx.changeAmount) : null,
          type: tx.type || "income",
        };
      });

    return {
      startDate,
      endDate,
      openingBalance: {
        cash: openingCash,
        banks: openingBankBalances.map((b) => ({
          ...b,
          bankName: bankMap.get(b.bankAccountId)?.bankName || "Unknown",
          accountNumber: bankMap.get(b.bankAccountId)?.accountNumber || "",
          balance: Number(b.balance || 0),
        })),
        total: openingCash + openingBankBalances.reduce((sum, b) => sum + Number(b.balance || 0), 0),
      },
      closingBalance: {
        cash: closingCash,
        banks: closingBankBalances,
        total: closingCash + closingBankBalances.reduce((sum, b) => sum + Number(b.balance || 0), 0),
      },
      openingBalanceAdditions, // Opening balance additions for the date range
      steps, // Step-by-step transactions sorted by date/time ASC
      summary: {
        sales: {
          count: sales.length,
          // Calculate total from payments that occurred in the date range
          total: sales.reduce((sum, s) => {
            const payments = (s.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
            if (payments.length === 0) {
              // No payments array, use total if sale date is in range
              // Database stores dates in UTC, so we extract UTC date components for correct comparison
              const saleDate = new Date(s.date);
              const { year, month, day } = extractDateComponents(saleDate);
              // Normalize to noon (12:00:00) for consistent date comparison
              const saleDateNormalized = new Date(year, month, day, 12, 0, 0, 0);
              return (saleDateNormalized.getTime() >= start.getTime() && saleDateNormalized.getTime() <= end.getTime()) 
                ? sum + Number(s.total || 0) 
                : sum;
            }
            // Sum only payments that occurred in the date range
            return sum + payments.reduce((paymentSum, payment) => {
              const paymentDateOnly = payment.date ? parsePaymentDate(payment.date) : null;
              if (!paymentDateOnly) {
                // Normalize to noon (12:00:00) for consistent date comparison
                // Database stores dates in UTC, so we extract UTC date components for correct comparison
                const saleDate = new Date(s.date);
                const { year, month, day } = extractDateComponents(saleDate);
                const saleDateOnly = new Date(year, month, day, 12, 0, 0, 0);
                if (saleDateOnly.getTime() >= start.getTime() && saleDateOnly.getTime() <= end.getTime()) {
                  return paymentSum + Number(payment.amount || 0);
                }
                return paymentSum;
              }
              if (paymentDateOnly.getTime() >= start.getTime() && paymentDateOnly.getTime() <= end.getTime()) {
                return paymentSum + Number(payment.amount || 0);
              }
              return paymentSum;
            }, 0);
          }, 0),
        },
        purchases: {
          count: purchases.length,
          // Calculate total from payments that occurred in the date range
          total: purchases.reduce((sum, p) => {
            const payments = (p.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
            if (payments.length === 0) {
              // No payments array, use total if purchase date is in range
              // Database stores dates in UTC, so we extract UTC date components for correct comparison
              const purchaseDate = new Date(p.date);
              const { year, month, day } = extractDateComponents(purchaseDate);
              // Normalize to noon (12:00:00) for consistent date comparison
              const purchaseDateNormalized = new Date(year, month, day, 12, 0, 0, 0);
              return (purchaseDateNormalized.getTime() >= start.getTime() && purchaseDateNormalized.getTime() <= end.getTime())
                ? sum + Number(p.total || 0)
                : sum;
            }
            // Sum only payments that occurred in the date range
            return sum + payments.reduce((paymentSum, payment) => {
              const paymentDateOnly = payment.date ? parsePaymentDate(payment.date) : null;
              if (!paymentDateOnly) {
                // Database stores dates in UTC, so we extract UTC date components for correct comparison
                const purchaseDate = new Date(p.date);
                const { year: purchaseYear, month: purchaseMonth, day: purchaseDay } = extractDateComponents(purchaseDate);
                const purchaseDateOnly = new Date(purchaseYear, purchaseMonth, purchaseDay, 12, 0, 0, 0);
                if (purchaseDateOnly.getTime() >= start.getTime() && purchaseDateOnly.getTime() <= end.getTime()) {
                  return paymentSum + Number(payment.amount || 0);
                }
                return paymentSum;
              }
              if (paymentDateOnly.getTime() >= start.getTime() && paymentDateOnly.getTime() <= end.getTime()) {
                return paymentSum + Number(payment.amount || 0);
              }
              return paymentSum;
            }, 0);
          }, 0),
        },
        expenses: {
          count: expenses.length,
          total: expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
        },
      },
      sales: {
        // Expand sales into payment rows - each payment becomes a separate row
        // Use a Set to track seen payment keys (sale.id + paymentIndex) to prevent duplicates
        items: (() => {
          const seenSalePayments = new Set<string>();
          return sales.flatMap((sale) => {
            const payments = (sale.payments as Array<{ type?: string; amount?: number; date?: string; cardId?: string; bankAccountId?: string }> | null) || [];
            if (payments.length === 0) {
              // If no payments array, create a single row from sale date if in range
              const saleDate = new Date(sale.date);
              saleDate.setHours(0, 0, 0, 0);
              if (saleDate.getTime() >= start.getTime() && saleDate.getTime() <= end.getTime()) {
                const paymentKey = `${sale.id}-0`;
                if (seenSalePayments.has(paymentKey)) {
                  return [];
                }
                seenSalePayments.add(paymentKey);
                return [{
                  ...sale,
                  paymentAmount: Number(sale.total || 0),
                  paymentDate: sale.date,
                  paymentType: sale.paymentType || "cash",
                  paymentIndex: 0,
                }];
              }
              return [];
            }
            // Create a row for each payment that matches the date range
            return payments
              .map((payment, index) => {
                // Create a more specific key that includes payment type and amount to prevent duplicates
                const paymentType = payment.type || sale.paymentType || "cash";
                const paymentAmount = Number(payment.amount || 0);
                const paymentKey = `${sale.id}-${index}-${paymentType}-${paymentAmount.toFixed(2)}`;
                // Skip if we've already seen this payment
                if (seenSalePayments.has(paymentKey)) {
                  return null;
                }
                
                const paymentDateOnly = payment.date ? parsePaymentDate(payment.date) : null;
                if (!paymentDateOnly) {
                  const saleDate = new Date(sale.date);
                  const saleYear = saleDate.getFullYear();
                  const saleMonth = saleDate.getMonth();
                  const saleDay = saleDate.getDate();
                  const saleDateOnly = new Date(saleYear, saleMonth, saleDay, 0, 0, 0, 0);
                  if (saleDateOnly.getTime() >= start.getTime() && saleDateOnly.getTime() <= end.getTime()) {
                    seenSalePayments.add(paymentKey);
                    return {
                      ...sale,
                      paymentAmount: paymentAmount,
                      paymentDate: sale.date,
                      paymentType: paymentType,
                      paymentIndex: index,
                    };
                  }
                  return null;
                }
                if (paymentDateOnly.getTime() >= start.getTime() && paymentDateOnly.getTime() <= end.getTime()) {
                  seenSalePayments.add(paymentKey);
                  return {
                    ...sale,
                    paymentAmount: paymentAmount,
                    paymentDate: payment.date || sale.date,
                    paymentType: paymentType,
                    paymentIndex: index,
                  };
                }
                return null;
              })
              .filter((row) => row !== null);
          });
        })(),
        total: sales.reduce((sum, s) => {
          const payments = (s.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
          if (payments.length === 0) {
            const saleDate = new Date(s.date);
            saleDate.setHours(0, 0, 0, 0);
            return saleDate.getTime() >= start.getTime() && saleDate.getTime() <= end.getTime() ? sum + Number(s.total || 0) : sum;
          }
          return sum + payments.reduce((paymentSum, payment) => {
            const paymentDateOnly = payment.date ? parsePaymentDate(payment.date) : null;
            if (!paymentDateOnly) {
              const saleDate = new Date(s.date);
              const saleYear = saleDate.getFullYear();
              const saleMonth = saleDate.getMonth();
              const saleDay = saleDate.getDate();
              const saleDateOnly = new Date(saleYear, saleMonth, saleDay, 0, 0, 0, 0);
              if (saleDateOnly.getTime() >= start.getTime() && saleDateOnly.getTime() <= end.getTime()) {
                return paymentSum + Number(payment.amount || 0);
              }
              return paymentSum;
            }
            if (paymentDateOnly.getTime() >= start.getTime() && paymentDateOnly.getTime() <= end.getTime()) {
              return paymentSum + Number(payment.amount || 0);
            }
            return paymentSum;
          }, 0);
        }, 0),
        cash: sales.reduce((sum, s) => {
          const payments = (s.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
          const cashPayments = payments.filter(p => p.type === "cash");
          return sum + cashPayments.reduce((paymentSum, payment) => {
            const paymentDateOnly = payment.date ? parsePaymentDate(payment.date) : null;
            if (!paymentDateOnly) {
              // Fallback to sale date
              const saleDate = new Date(s.date);
              const saleYear = saleDate.getFullYear();
              const saleMonth = saleDate.getMonth();
              const saleDay = saleDate.getDate();
              const saleDateOnly = new Date(saleYear, saleMonth, saleDay, 0, 0, 0, 0);
              if (saleDateOnly.getTime() >= start.getTime() && saleDateOnly.getTime() <= end.getTime()) {
                return paymentSum + Number(payment.amount || 0);
              }
              return paymentSum;
            }
            if (paymentDateOnly.getTime() >= start.getTime() && paymentDateOnly.getTime() <= end.getTime()) {
              return paymentSum + Number(payment.amount || 0);
            }
            return paymentSum;
          }, 0);
        }, 0),
        bank_transfer: sales.reduce((sum, s) => {
          const payments = (s.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
          const bankPayments = payments.filter(p => p.type === "bank_transfer");
          return sum + bankPayments.reduce((paymentSum, payment) => {
            const paymentDateOnly = payment.date ? parsePaymentDate(payment.date) : null;
            if (!paymentDateOnly) {
              // Fallback to sale date
              const saleDate = new Date(s.date);
              const saleYear = saleDate.getFullYear();
              const saleMonth = saleDate.getMonth();
              const saleDay = saleDate.getDate();
              const saleDateOnly = new Date(saleYear, saleMonth, saleDay, 0, 0, 0, 0);
              if (saleDateOnly.getTime() >= start.getTime() && saleDateOnly.getTime() <= end.getTime()) {
                return paymentSum + Number(payment.amount || 0);
              }
              return paymentSum;
            }
            if (paymentDateOnly.getTime() >= start.getTime() && paymentDateOnly.getTime() <= end.getTime()) {
              return paymentSum + Number(payment.amount || 0);
            }
            return paymentSum;
          }, 0);
        }, 0),
        card: sales.reduce((sum, s) => {
          const payments = (s.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
          const cardPayments = payments.filter(p => p.type === "card");
          return sum + cardPayments.reduce((paymentSum, payment) => {
            const paymentDate = payment.date ? new Date(payment.date) : new Date(s.date);
            paymentDate.setHours(0, 0, 0, 0);
            if (paymentDate.getTime() >= start.getTime() && paymentDate.getTime() <= end.getTime()) {
              return paymentSum + Number(payment.amount || 0);
            }
            return paymentSum;
          }, 0);
        }, 0),
      },
      purchases: {
        // Expand purchases into payment rows - each payment becomes a separate row
        // Use a Set to track seen payment keys (purchase.id + paymentIndex) to prevent duplicates
        items: (() => {
          const seenPurchasePayments = new Set<string>();
          return purchases.flatMap((purchase) => {
            const payments = (purchase.payments as Array<{ type?: string; amount?: number; date?: string; cardId?: string; bankAccountId?: string }> | null) || [];
            if (payments.length === 0) {
              // If no payments array, create a single row from purchase date if in range
              const purchaseDate = new Date(purchase.date);
              purchaseDate.setHours(0, 0, 0, 0);
              if (purchaseDate.getTime() >= start.getTime() && purchaseDate.getTime() <= end.getTime()) {
                const paymentKey = `${purchase.id}-0`;
                if (seenPurchasePayments.has(paymentKey)) {
                  return [];
                }
                seenPurchasePayments.add(paymentKey);
                return [{
                  ...purchase,
                  paymentAmount: Number(purchase.total || 0),
                  paymentDate: purchase.date,
                  paymentType: "cash",
                  paymentIndex: 0,
                }];
              }
              return [];
            }
            // Create a row for each payment that matches the date range
            return payments
              .map((payment, index) => {
                // Create a more specific key that includes payment type and amount to prevent duplicates
                const paymentType = payment.type || "cash";
                const paymentAmount = Number(payment.amount || 0);
                const paymentKey = `${purchase.id}-${index}-${paymentType}-${paymentAmount.toFixed(2)}`;
                // Skip if we've already seen this payment
                if (seenPurchasePayments.has(paymentKey)) {
                  return null;
                }
                
                const paymentDateRaw = payment.date ? new Date(payment.date) : new Date(purchase.date);
                // Normalize to noon (12:00:00) for consistent date comparison
                const paymentDate = normalizeDateToNoon(paymentDateRaw);
                if (paymentDate.getTime() >= start.getTime() && paymentDate.getTime() <= end.getTime()) {
                  seenPurchasePayments.add(paymentKey);
                  return {
                    ...purchase,
                    paymentAmount: paymentAmount,
                    paymentDate: payment.date || purchase.date,
                    paymentType: paymentType,
                    paymentIndex: index,
                  };
                }
                return null;
              })
              .filter((row) => row !== null);
          });
        })(),
        total: purchases.reduce((sum, p) => {
          const payments = (p.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
          if (payments.length === 0) {
            const purchaseDate = new Date(p.date);
            purchaseDate.setHours(0, 0, 0, 0);
            return purchaseDate.getTime() >= start.getTime() && purchaseDate.getTime() <= end.getTime() ? sum + Number(p.total || 0) : sum;
          }
          return sum + payments.reduce((paymentSum, payment) => {
            const paymentDateOnly = payment.date ? parsePaymentDate(payment.date) : null;
            if (!paymentDateOnly) {
              const purchaseDate = new Date(p.date);
              const purchaseYear = purchaseDate.getFullYear();
              const purchaseMonth = purchaseDate.getMonth();
              const purchaseDay = purchaseDate.getDate();
              const purchaseDateOnly = new Date(purchaseYear, purchaseMonth, purchaseDay, 0, 0, 0, 0);
              if (purchaseDateOnly.getTime() >= start.getTime() && purchaseDateOnly.getTime() <= end.getTime()) {
                return paymentSum + Number(payment.amount || 0);
              }
              return paymentSum;
            }
            if (paymentDateOnly.getTime() >= start.getTime() && paymentDateOnly.getTime() <= end.getTime()) {
              return paymentSum + Number(payment.amount || 0);
            }
            return paymentSum;
          }, 0);
        }, 0),
        cash: purchases.reduce((sum, p) => {
          const payments = (p.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
          const cashPayments = payments.filter(pay => pay.type === "cash");
          return sum + cashPayments.reduce((paymentSum, payment) => {
            const paymentDateOnly = payment.date ? parsePaymentDate(payment.date) : null;
            if (!paymentDateOnly) {
              // Fallback to purchase date
              const purchaseDate = normalizeDateToNoon(new Date(p.date));
              if (purchaseDate.getTime() >= start.getTime() && purchaseDate.getTime() <= end.getTime()) {
                return paymentSum + Number(payment.amount || 0);
              }
              return paymentSum;
            }
            if (paymentDateOnly.getTime() >= start.getTime() && paymentDateOnly.getTime() <= end.getTime()) {
              return paymentSum + Number(payment.amount || 0);
            }
            return paymentSum;
          }, 0);
        }, 0),
        bank_transfer: purchases.reduce((sum, p) => {
          const payments = (p.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
          const bankPayments = payments.filter(pay => pay.type === "bank_transfer");
          return sum + bankPayments.reduce((paymentSum, payment) => {
            const paymentDateOnly = payment.date ? parsePaymentDate(payment.date) : null;
            if (!paymentDateOnly) {
              // Fallback to purchase date
              const purchaseDate = normalizeDateToNoon(new Date(p.date));
              if (purchaseDate.getTime() >= start.getTime() && purchaseDate.getTime() <= end.getTime()) {
                return paymentSum + Number(payment.amount || 0);
              }
              return paymentSum;
            }
            if (paymentDateOnly.getTime() >= start.getTime() && paymentDateOnly.getTime() <= end.getTime()) {
              return paymentSum + Number(payment.amount || 0);
            }
            return paymentSum;
          }, 0);
        }, 0),
        card: purchases.reduce((sum, p) => {
          const payments = (p.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
          const cardPayments = payments.filter(pay => pay.type === "card");
          return sum + cardPayments.reduce((paymentSum, payment) => {
            const paymentDate = payment.date ? new Date(payment.date) : new Date(p.date);
            paymentDate.setHours(0, 0, 0, 0);
            if (paymentDate.getTime() >= start.getTime() && paymentDate.getTime() <= end.getTime()) {
              return paymentSum + Number(payment.amount || 0);
            }
            return paymentSum;
          }, 0);
        }, 0),
      },
      expenses: {
        items: expenses,
        total: expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
        cash: expenses.filter(e => e.paymentType === "cash").reduce((sum, e) => sum + Number(e.amount || 0), 0),
        bank_transfer: expenses.filter(e => e.paymentType === "bank_transfer").reduce((sum, e) => sum + Number(e.amount || 0), 0),
        card: 0, // Expenses don't use card payments
      },
      // Generate daily reports for each day in the range for date-wise display
      dailyReports: await this.generateDailyReportsForRange(startDate, endDate),
      // Include all transactions (steps) for chronological display
      transactions: steps,
    };
  }

  /**
   * Generate daily reports for each day in a date range
   */
  private async generateDailyReportsForRange(startDate: string, endDate: string): Promise<any[]> {
    const start = parseLocalYMD(startDate);
    start.setHours(0, 0, 0, 0);
    const end = parseLocalYMD(endDate);
    end.setHours(23, 59, 59, 999);

    const dailyReports: any[] = [];
    const currentDate = new Date(start);

    // Generate a daily report for each day in the range
    while (currentDate.getTime() <= end.getTime()) {
      const dateStr = formatLocalYMD(currentDate);
      try {
        const dailyReport = await this.getDailyReport(dateStr);
        dailyReports.push(dailyReport);
      } catch (error) {
        logger.error(`Error generating daily report for ${dateStr}:`, error);
        // Continue with other dates even if one fails
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return dailyReports;
  }

  // Keep old methods for backward compatibility (simplified versions)
  async getSalesReport(filters: { startDate?: string; endDate?: string }) {
    const where: any = {};

    if (filters.startDate && filters.endDate) {
      const start = parseLocalYMD(filters.startDate);
      start.setHours(0, 0, 0, 0);
      const end = parseLocalYMD(filters.endDate);
      end.setHours(23, 59, 59, 999);

      where.date = { gte: start, lte: end };
    }

    const sales = await prisma.sale.findMany({
      where,
      include: { items: true, customer: true },
      orderBy: { createdAt: "asc" },
    });

    const totalSales = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
    const totalBills = sales.length;

    return {
      sales,
      summary: {
        totalSales,
        totalBills,
        averageBill: totalBills > 0 ? totalSales / totalBills : 0,
      },
    };
  }

  async getExpensesReport(filters: { startDate?: string; endDate?: string }) {
    const where: any = {};

    if (filters.startDate && filters.endDate) {
      const start = parseLocalYMD(filters.startDate);
      start.setHours(0, 0, 0, 0);
      const end = parseLocalYMD(filters.endDate);
      end.setHours(23, 59, 59, 999);

      where.date = { gte: start, lte: end };
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { createdAt: "asc" },
    });

    const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    const categoryTotals = expenses.reduce((acc, exp) => {
      acc[exp.category] = (acc[exp.category] || 0) + Number(exp.amount);
      return acc;
    }, {} as Record<string, number>);

    return {
      expenses,
      summary: {
        totalExpenses,
        categoryTotals,
      },
    };
  }

  async getProfitLossReport(filters: { startDate?: string; endDate?: string }) {
    const dateFilter: any = {};
    if (filters.startDate && filters.endDate) {
      const start = parseLocalYMD(filters.startDate);
      start.setHours(0, 0, 0, 0);
      const end = parseLocalYMD(filters.endDate);
      end.setHours(23, 59, 59, 999);

      dateFilter.gte = start;
      dateFilter.lte = end;
    }

    const sales = await prisma.sale.findMany({
      where: {
        date: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
      },
      orderBy: { createdAt: "asc" },
    });

    const expenses = await prisma.expense.findMany({
      where: {
        date: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
      },
      orderBy: { createdAt: "asc" },
    });

    const totalSales = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    const profit = totalSales - totalExpenses;

    return {
      totalSales,
      totalExpenses,
      profit,
      profitMargin: totalSales > 0 ? (profit / totalSales) * 100 : 0,
      period: {
        startDate: filters.startDate || null,
        endDate: filters.endDate || null,
      },
    };
  }

  // PDF generation methods (simplified - can be enhanced later)
  async generateDailyReportPDF(date: string, res: Response) {
    try {
      const report = await this.getDailyReport(date);
      const settings = await prisma.shopSettings.findFirst();

      const doc = new PDFDocument({ 
        margin: 50,
        size: 'A4',
        info: {
          Title: `Daily Report - ${date}`,
          Author: settings?.shopName || "Isma Sports Complex",
        }
      });

      doc.on('error', (err) => {
        logger.error("PDFkit error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to generate PDF" });
        }
      });

      if (!res.headersSent) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=daily-report-${date}.pdf`);
      }

      doc.pipe(res);

      // Helper function to format currency
      const formatCurrency = (amount: number) => {
        return `Rs. ${Number(amount).toFixed(2)}`;
      };

      // Helper function to add section header (compact)
      const addSectionHeader = (text: string, fontSize: number = 14) => {
        if (doc.y > 700) doc.addPage();
        doc.moveDown(0.5);
        doc.fontSize(fontSize).fillColor('#1e40af').text(text, { underline: true });
        doc.fillColor('#000000');
        doc.moveDown(0.3);
      };

      // Helper function to add table row (compact)
      const addTableRow = (label: string, value: string, isBold: boolean = false) => {
        if (doc.y > 750) doc.addPage();
        doc.fontSize(10);
        if (isBold) doc.font('Helvetica-Bold');
        doc.text(label, 50, doc.y, { width: 200 });
        doc.text(value, 250, doc.y, { width: 250, align: 'right' });
        if (isBold) doc.font('Helvetica');
        doc.moveDown(0.4);
      };

      // Simple Professional Header
      doc.fontSize(20).fillColor('#1e3a8a').font('Helvetica-Bold').text(settings?.shopName || "Isma Sports Complex", { align: "center" });
      doc.moveDown(0.3);
      doc.fontSize(13).fillColor('#374151').font('Helvetica').text("Daily Report", { align: "center" });
      doc.moveDown(0.2);
      doc.fontSize(10).fillColor('#6b7280').text(`${new Date(date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, { align: "center" });
      doc.moveDown(0.4);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#9ca3af');
      doc.moveDown(0.3);

      // Professional Summary Table with Payment Breakdown
      const summaryTableTop = doc.y;
      const summaryRowHeight = 14;
      
      // Helper to draw summary cell
      const drawSummaryCell = (x: number, y: number, width: number, height: number, fillColor?: string) => {
        if (fillColor) {
          doc.rect(x, y, width, height).fill(fillColor);
        }
        doc.moveTo(x, y).lineTo(x + width, y).stroke('#000000');
        doc.moveTo(x + width, y).lineTo(x + width, y + height).stroke('#000000');
        doc.moveTo(x + width, y + height).lineTo(x, y + height).stroke('#000000');
        doc.moveTo(x, y + height).lineTo(x, y).stroke('#000000');
      };

      // Summary table columns (Item, Cash, Bank, Total - Card removed)
      const sumColX = [50, 200, 320, 440];
      const sumColWidths = [150, 120, 120, 105];
      
      // Header row - dark blue background with white text for better visibility
      doc.fontSize(9).font('Helvetica-Bold');
      
      // Draw all header cells first with background
      drawSummaryCell(sumColX[0], summaryTableTop, sumColWidths[0], summaryRowHeight, '#1e40af');
      drawSummaryCell(sumColX[1], summaryTableTop, sumColWidths[1], summaryRowHeight, '#1e40af');
      drawSummaryCell(sumColX[2], summaryTableTop, sumColWidths[2], summaryRowHeight, '#1e40af');
      drawSummaryCell(sumColX[3], summaryTableTop, sumColWidths[3], summaryRowHeight, '#1e40af');
      
      // Now add white text on top of the cells
      doc.fillColor('#ffffff');
      doc.text("Item", sumColX[0] + 5, summaryTableTop + 4, { width: sumColWidths[0] - 10 });
      doc.text("Cash", sumColX[1] + 5, summaryTableTop + 4, { width: sumColWidths[1] - 10, align: 'right' });
      doc.text("Bank", sumColX[2] + 5, summaryTableTop + 4, { width: sumColWidths[2] - 10, align: 'right' });
      doc.text("Total", sumColX[3] + 5, summaryTableTop + 4, { width: sumColWidths[3] - 10, align: 'right' });
      doc.fillColor('#000000');

      let currentRow = 1;
      doc.font('Helvetica').fontSize(8);

      // Opening Balance Row
      const openingCash = report.openingBalance.cash || 0;
      const openingBank = report.openingBalance.banks?.reduce((sum: number, b: any) => sum + Number(b.balance || 0), 0) || 0;
      const openingTotal = openingCash + openingBank;
      drawSummaryCell(sumColX[0], summaryTableTop + (currentRow * summaryRowHeight), sumColWidths[0], summaryRowHeight);
      doc.font('Helvetica-Bold').fillColor('#1f2937');
      doc.text("Opening", sumColX[0] + 5, summaryTableTop + (currentRow * summaryRowHeight) + 4, { width: sumColWidths[0] - 10 });
      doc.font('Helvetica').fillColor('#000000');
      drawSummaryCell(sumColX[1], summaryTableTop + (currentRow * summaryRowHeight), sumColWidths[1], summaryRowHeight);
      doc.fillColor('#374151');
      doc.text(formatCurrency(openingCash), sumColX[1] + 5, summaryTableTop + (currentRow * summaryRowHeight) + 4, { width: sumColWidths[1] - 10, align: 'right' });
      doc.fillColor('#000000');
      drawSummaryCell(sumColX[2], summaryTableTop + (currentRow * summaryRowHeight), sumColWidths[2], summaryRowHeight);
      doc.fillColor('#374151');
      doc.text(formatCurrency(openingBank), sumColX[2] + 5, summaryTableTop + (currentRow * summaryRowHeight) + 4, { width: sumColWidths[2] - 10, align: 'right' });
      doc.fillColor('#000000');
      drawSummaryCell(sumColX[3], summaryTableTop + (currentRow * summaryRowHeight), sumColWidths[3], summaryRowHeight);
      doc.font('Helvetica-Bold').fillColor('#1f2937');
      doc.text(formatCurrency(openingTotal), sumColX[3] + 5, summaryTableTop + (currentRow * summaryRowHeight) + 4, { width: sumColWidths[3] - 10, align: 'right' });
      doc.font('Helvetica').fillColor('#000000');
      currentRow++;

      // Additional Balance Added Row
      const additionalTotal = report.openingBalanceAdditions?.reduce((sum: number, add: any) => sum + Number(add.amount || 0), 0) || 0;
      if (additionalTotal > 0) {
        const additionalCash = report.openingBalanceAdditions?.filter((add: any) => add.paymentType === "cash").reduce((sum: number, add: any) => sum + Number(add.amount || 0), 0) || 0;
        const additionalBank = report.openingBalanceAdditions?.filter((add: any) => add.paymentType === "bank_transfer").reduce((sum: number, add: any) => sum + Number(add.amount || 0), 0) || 0;
        drawSummaryCell(sumColX[0], summaryTableTop + (currentRow * summaryRowHeight), sumColWidths[0], summaryRowHeight);
        doc.font('Helvetica-Bold').fillColor('#1f2937');
        doc.text("Added", sumColX[0] + 5, summaryTableTop + (currentRow * summaryRowHeight) + 4, { width: sumColWidths[0] - 10 });
        doc.font('Helvetica').fillColor('#000000');
        drawSummaryCell(sumColX[1], summaryTableTop + (currentRow * summaryRowHeight), sumColWidths[1], summaryRowHeight);
        doc.fillColor('#16a34a');
        doc.text(formatCurrency(additionalCash), sumColX[1] + 5, summaryTableTop + (currentRow * summaryRowHeight) + 4, { width: sumColWidths[1] - 10, align: 'right' });
        doc.fillColor('#000000');
        drawSummaryCell(sumColX[2], summaryTableTop + (currentRow * summaryRowHeight), sumColWidths[2], summaryRowHeight);
        doc.fillColor('#16a34a');
        doc.text(formatCurrency(additionalBank), sumColX[2] + 5, summaryTableTop + (currentRow * summaryRowHeight) + 4, { width: sumColWidths[2] - 10, align: 'right' });
        doc.fillColor('#000000');
        drawSummaryCell(sumColX[3], summaryTableTop + (currentRow * summaryRowHeight), sumColWidths[3], summaryRowHeight);
        doc.font('Helvetica-Bold').fillColor('#16a34a');
        doc.text(formatCurrency(additionalTotal), sumColX[3] + 5, summaryTableTop + (currentRow * summaryRowHeight) + 4, { width: sumColWidths[3] - 10, align: 'right' });
        doc.font('Helvetica').fillColor('#000000');
        currentRow++;
      }

      // Sales Row
      const salesCash = report.sales?.cash || 0;
      const salesBank = report.sales?.bank_transfer || 0;
      const salesTotal = report.sales?.total || 0;
      drawSummaryCell(sumColX[0], summaryTableTop + (currentRow * summaryRowHeight), sumColWidths[0], summaryRowHeight);
      doc.font('Helvetica-Bold').fillColor('#1f2937');
      doc.text("Sales", sumColX[0] + 5, summaryTableTop + (currentRow * summaryRowHeight) + 4, { width: sumColWidths[0] - 10 });
      doc.font('Helvetica').fillColor('#000000');
      drawSummaryCell(sumColX[1], summaryTableTop + (currentRow * summaryRowHeight), sumColWidths[1], summaryRowHeight);
      doc.fillColor('#16a34a');
      doc.text(formatCurrency(salesCash), sumColX[1] + 5, summaryTableTop + (currentRow * summaryRowHeight) + 4, { width: sumColWidths[1] - 10, align: 'right' });
      doc.fillColor('#000000');
      drawSummaryCell(sumColX[2], summaryTableTop + (currentRow * summaryRowHeight), sumColWidths[2], summaryRowHeight);
      doc.fillColor('#16a34a');
      doc.text(formatCurrency(salesBank), sumColX[2] + 5, summaryTableTop + (currentRow * summaryRowHeight) + 4, { width: sumColWidths[2] - 10, align: 'right' });
      doc.fillColor('#000000');
      drawSummaryCell(sumColX[3], summaryTableTop + (currentRow * summaryRowHeight), sumColWidths[3], summaryRowHeight);
      doc.font('Helvetica-Bold').fillColor('#16a34a');
      doc.text(formatCurrency(salesTotal), sumColX[3] + 5, summaryTableTop + (currentRow * summaryRowHeight) + 4, { width: sumColWidths[3] - 10, align: 'right' });
      doc.font('Helvetica').fillColor('#000000');
      currentRow++;

      // Purchases Row
      const purchasesCash = report.purchases?.cash || 0;
      const purchasesBank = report.purchases?.bank_transfer || 0;
      const purchasesTotal = report.purchases?.total || 0;
      drawSummaryCell(sumColX[0], summaryTableTop + (currentRow * summaryRowHeight), sumColWidths[0], summaryRowHeight);
      doc.font('Helvetica-Bold').fillColor('#1f2937');
      doc.text("Purchase", sumColX[0] + 5, summaryTableTop + (currentRow * summaryRowHeight) + 4, { width: sumColWidths[0] - 10 });
      doc.font('Helvetica').fillColor('#000000');
      drawSummaryCell(sumColX[1], summaryTableTop + (currentRow * summaryRowHeight), sumColWidths[1], summaryRowHeight);
      doc.fillColor('#ea580c');
      doc.text(formatCurrency(purchasesCash), sumColX[1] + 5, summaryTableTop + (currentRow * summaryRowHeight) + 4, { width: sumColWidths[1] - 10, align: 'right' });
      doc.fillColor('#000000');
      drawSummaryCell(sumColX[2], summaryTableTop + (currentRow * summaryRowHeight), sumColWidths[2], summaryRowHeight);
      doc.fillColor('#ea580c');
      doc.text(formatCurrency(purchasesBank), sumColX[2] + 5, summaryTableTop + (currentRow * summaryRowHeight) + 4, { width: sumColWidths[2] - 10, align: 'right' });
      doc.fillColor('#000000');
      drawSummaryCell(sumColX[3], summaryTableTop + (currentRow * summaryRowHeight), sumColWidths[3], summaryRowHeight);
      doc.font('Helvetica-Bold').fillColor('#ea580c');
      doc.text(formatCurrency(purchasesTotal), sumColX[3] + 5, summaryTableTop + (currentRow * summaryRowHeight) + 4, { width: sumColWidths[3] - 10, align: 'right' });
      doc.font('Helvetica').fillColor('#000000');
      currentRow++;

      // Expenses Row
      const expensesCash = report.expenses?.cash || 0;
      const expensesBank = report.expenses?.bank_transfer || 0;
      const expensesTotal = report.expenses?.total || 0;
      drawSummaryCell(sumColX[0], summaryTableTop + (currentRow * summaryRowHeight), sumColWidths[0], summaryRowHeight);
      doc.font('Helvetica-Bold').fillColor('#1f2937');
      doc.text("Expense", sumColX[0] + 5, summaryTableTop + (currentRow * summaryRowHeight) + 4, { width: sumColWidths[0] - 10 });
      doc.font('Helvetica').fillColor('#000000');
      drawSummaryCell(sumColX[1], summaryTableTop + (currentRow * summaryRowHeight), sumColWidths[1], summaryRowHeight);
      doc.fillColor('#dc2626');
      doc.text(formatCurrency(expensesCash), sumColX[1] + 5, summaryTableTop + (currentRow * summaryRowHeight) + 4, { width: sumColWidths[1] - 10, align: 'right' });
      doc.fillColor('#000000');
      drawSummaryCell(sumColX[2], summaryTableTop + (currentRow * summaryRowHeight), sumColWidths[2], summaryRowHeight);
      doc.fillColor('#dc2626');
      doc.text(formatCurrency(expensesBank), sumColX[2] + 5, summaryTableTop + (currentRow * summaryRowHeight) + 4, { width: sumColWidths[2] - 10, align: 'right' });
      doc.fillColor('#000000');
      drawSummaryCell(sumColX[3], summaryTableTop + (currentRow * summaryRowHeight), sumColWidths[3], summaryRowHeight);
      doc.font('Helvetica-Bold').fillColor('#dc2626');
      doc.text(formatCurrency(expensesTotal), sumColX[3] + 5, summaryTableTop + (currentRow * summaryRowHeight) + 4, { width: sumColWidths[3] - 10, align: 'right' });
      doc.font('Helvetica').fillColor('#000000');
      currentRow++;

      // Closing Balance Row
      const closingCash = report.closingBalance.cash || 0;
      const closingBank = report.closingBalance.banks?.reduce((sum: number, b: any) => sum + Number(b.balance || 0), 0) || 0;
      const closingTotal = report.closingBalance.total || 0;
      drawSummaryCell(sumColX[0], summaryTableTop + (currentRow * summaryRowHeight), sumColWidths[0], summaryRowHeight, '#dbeafe');
      doc.font('Helvetica-Bold').fillColor('#1e3a8a');
      doc.text("Closing", sumColX[0] + 5, summaryTableTop + (currentRow * summaryRowHeight) + 4, { width: sumColWidths[0] - 10 });
      drawSummaryCell(sumColX[1], summaryTableTop + (currentRow * summaryRowHeight), sumColWidths[1], summaryRowHeight, '#dbeafe');
      doc.fillColor('#1e3a8a');
      doc.text(formatCurrency(closingCash), sumColX[1] + 5, summaryTableTop + (currentRow * summaryRowHeight) + 4, { width: sumColWidths[1] - 10, align: 'right' });
      drawSummaryCell(sumColX[2], summaryTableTop + (currentRow * summaryRowHeight), sumColWidths[2], summaryRowHeight, '#dbeafe');
      doc.fillColor('#1e3a8a');
      doc.text(formatCurrency(closingBank), sumColX[2] + 5, summaryTableTop + (currentRow * summaryRowHeight) + 4, { width: sumColWidths[2] - 10, align: 'right' });
      drawSummaryCell(sumColX[3], summaryTableTop + (currentRow * summaryRowHeight), sumColWidths[3], summaryRowHeight, '#dbeafe');
      doc.font('Helvetica-Bold').fillColor('#1e3a8a');
      doc.text(formatCurrency(closingTotal), sumColX[3] + 5, summaryTableTop + (currentRow * summaryRowHeight) + 4, { width: sumColWidths[3] - 10, align: 'right' });
      doc.font('Helvetica').fillColor('#000000');

      doc.y = summaryTableTop + ((currentRow + 1) * summaryRowHeight) + 5;
      doc.moveDown(0.3);
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#cccccc');
      doc.moveDown(0.3);

      // Simple Transaction Table Title
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#374151').text("All Transactions", 50, doc.y);
      doc.fillColor('#000000');
      doc.font('Helvetica');
      doc.moveDown(0.2);

      // Detailed Transactions Table (Using steps array with balance before/after)
      const transactionSteps = report.steps || [];
      
      if (transactionSteps.length > 0) {
        if (doc.y > 680) doc.addPage();
        
        // Helper function to draw cell borders
        const drawCellBorders = (x: number, y: number, width: number, height: number) => {
          // Top, Right, Bottom, Left borders
          doc.moveTo(x, y).lineTo(x + width, y).stroke('#000000'); // Top
          doc.moveTo(x + width, y).lineTo(x + width, y + height).stroke('#000000'); // Right
          doc.moveTo(x + width, y + height).lineTo(x, y + height).stroke('#000000'); // Bottom
          doc.moveTo(x, y + height).lineTo(x, y).stroke('#000000'); // Left
        };
        
        // Professional table header - clear and visible with dark background and white text
        doc.fontSize(8).font('Helvetica-Bold');
        const tableTop = doc.y;
        const rowHeight = 14;
        // Removed Amount column - columns: Time, Type, Description, By, Pay, Before, After, Change
        // Expanded columns to use more space on the right
        const colX = [50, 100, 135, 220, 270, 340, 410, 480];
        const colWidths = [50, 35, 85, 50, 70, 70, 70, 70];
        
        // Draw header with dark blue background for better visibility
        colX.forEach((x, idx) => {
          doc.rect(x, tableTop, colWidths[idx], rowHeight).fill('#1e40af');
          drawCellBorders(x, tableTop, colWidths[idx], rowHeight);
        });
        
        // Header text - white text on dark background for maximum visibility
        // Columns: Time, Type, Description, By, Pay, Before, After, Change (Amount removed)
        doc.fillColor('#ffffff');
        doc.text("Time", colX[0] + 3, tableTop + 4, { width: colWidths[0] - 6 });
        doc.text("Type", colX[1] + 3, tableTop + 4, { width: colWidths[1] - 6 });
        doc.text("Description", colX[2] + 3, tableTop + 4, { width: colWidths[2] - 6 });
        doc.text("By", colX[3] + 3, tableTop + 4, { width: colWidths[3] - 6 });
        doc.text("Pay", colX[4] + 3, tableTop + 4, { width: colWidths[4] - 6 });
        doc.text("Before", colX[5] + 3, tableTop + 4, { width: colWidths[5] - 6, align: 'right' });
        doc.text("After", colX[6] + 3, tableTop + 4, { width: colWidths[6] - 6, align: 'right' });
        doc.text("Change", colX[7] + 3, tableTop + 4, { width: colWidths[7] - 6, align: 'right' });
        doc.fillColor('#000000');
        
        doc.y = tableTop + rowHeight;
        
        // Table rows - professional spacing
        doc.font('Helvetica').fontSize(7);
        transactionSteps.forEach((step: any, index: number) => {
          if (doc.y > 750) {
            doc.addPage();
            // Redraw header on new page
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#1f2937');
            const newTableTop = doc.y;
            colX.forEach((x, idx) => {
              doc.rect(x, newTableTop, colWidths[idx], rowHeight).fill('#f3f4f6');
              drawCellBorders(x, newTableTop, colWidths[idx], rowHeight);
            });
            doc.text("Time", colX[0] + 3, newTableTop + 4, { width: colWidths[0] - 6 });
            doc.text("Type", colX[1] + 3, newTableTop + 4, { width: colWidths[1] - 6 });
            doc.text("Description", colX[2] + 3, newTableTop + 4, { width: colWidths[2] - 6 });
            doc.text("By", colX[3] + 3, newTableTop + 4, { width: colWidths[3] - 6 });
            doc.text("Pay", colX[4] + 3, newTableTop + 4, { width: colWidths[4] - 6 });
            doc.text("Before", colX[5] + 3, newTableTop + 4, { width: colWidths[5] - 6, align: 'right' });
            doc.text("After", colX[6] + 3, newTableTop + 4, { width: colWidths[6] - 6, align: 'right' });
            doc.text("Change", colX[7] + 3, newTableTop + 4, { width: colWidths[7] - 6, align: 'right' });
            doc.fillColor('#000000');
            doc.y = newTableTop + rowHeight;
            doc.font('Helvetica').fontSize(7);
          }

          // Format time correctly using local time components (no timezone conversion)
          let timeStr = "00:00";
          if (step.datetime) {
            const stepDate = step.datetime instanceof Date ? step.datetime : new Date(step.datetime);
            // Extract local time components directly to avoid timezone conversion
            const hours = String(stepDate.getHours()).padStart(2, '0');
            const minutes = String(stepDate.getMinutes()).padStart(2, '0');
            timeStr = `${hours}:${minutes}`;
          }
          const typeColor = step.type === "Sale" ? '#16a34a' : step.type === "Purchase" ? '#ea580c' : step.type === "Expense" ? '#dc2626' : step.type === "Opening Balance" ? '#3b82f6' : '#9333ea';
          
          const currentY = doc.y;
          
          // Alternate row background for better readability
          if (index % 2 === 0) {
            colX.forEach((x, idx) => {
              doc.rect(x, currentY, colWidths[idx], rowHeight).fill('#f9fafb');
            });
          }
          
          // Draw cell borders for this row
          colX.forEach((x, idx) => {
            drawCellBorders(x, currentY, colWidths[idx], rowHeight);
          });
          
          // Time
          doc.fillColor('#1f2937');
          doc.text(timeStr, colX[0] + 3, currentY + 4, { width: colWidths[0] - 6 });
          
          // Type (compact)
          doc.fillColor(typeColor);
          const typeShort = step.type === "Opening Balance Addition" ? "Add" : step.type === "Opening Balance" ? "Open" : step.type.substring(0, 5);
          doc.text(typeShort, colX[1] + 3, currentY + 4, { width: colWidths[1] - 6 });
          doc.fillColor('#000000');
          
          // Description (truncated to fit)
          let description = step.description || "";
          if (description.length > 18) description = description.substring(0, 15) + "...";
          doc.fillColor('#1f2937');
          doc.text(description, colX[2] + 3, currentY + 4, { width: colWidths[2] - 6 });
          doc.fillColor('#000000');
          
          // User name (who did it)
          const userName = step.userName || "System";
          doc.fillColor('#4b5563');
          doc.text(userName.length > 7 ? userName.substring(0, 5) + ".." : userName, colX[3] + 3, currentY + 4, { width: colWidths[3] - 6 });
          doc.fillColor('#000000');
          
          // Payment type
          const paymentType = step.paymentType || "cash";
          const paymentText = paymentType === "bank_transfer" ? "Bank" : paymentType === "cash" ? "Cash" : "Card";
          doc.fillColor('#4b5563');
          doc.text(paymentText, colX[4] + 3, currentY + 4, { width: colWidths[4] - 6 });
          doc.fillColor('#000000');
          
          // Balance Before - Show according to payment type (Cash or Bank)
          let balanceBefore = 0;
          if (paymentType === "cash") {
            // For cash payments, show cash balance before
            balanceBefore = Number(step.cashBefore || 0);
          } else if (paymentType === "bank_transfer" && step.bankAccountId) {
            // For bank payments, show the specific bank's balance before
            if (step.bankBalancesBefore && step.bankBalancesBefore.length > 0) {
              const bankBalance = step.bankBalancesBefore.find((b: any) => b.bankAccountId === step.bankAccountId);
              balanceBefore = Number(bankBalance?.balance || 0);
            } else {
              balanceBefore = 0;
            }
          } else {
            // Fallback to cash balance
            balanceBefore = Number(step.cashBefore || 0);
          }
          doc.fillColor('#6b7280');
          doc.text(balanceBefore.toFixed(0), colX[5] + 3, currentY + 4, { width: colWidths[5] - 6, align: 'right' });
          doc.fillColor('#000000');
          
          // Balance After - Show according to payment type (Cash or Bank)
          let balanceAfter = 0;
          if (paymentType === "cash") {
            // For cash payments, show cash balance after
            balanceAfter = Number(step.cashAfter || 0);
          } else if (paymentType === "bank_transfer" && step.bankAccountId) {
            // For bank payments, show the specific bank's balance after
            if (step.bankBalancesAfter && step.bankBalancesAfter.length > 0) {
              const bankBalance = step.bankBalancesAfter.find((b: any) => b.bankAccountId === step.bankAccountId);
              balanceAfter = Number(bankBalance?.balance || 0);
            } else {
              balanceAfter = 0;
            }
          } else {
            // Fallback to cash balance
            balanceAfter = Number(step.cashAfter || 0);
          }
          doc.fillColor('#1f2937');
          doc.text(balanceAfter.toFixed(0), colX[6] + 3, currentY + 4, { width: colWidths[6] - 6, align: 'right' });
          doc.fillColor('#000000');
          
          // Change
          const change = balanceAfter - balanceBefore;
          const changeColor = change >= 0 ? '#16a34a' : '#dc2626';
          doc.fillColor(changeColor);
          const changeText = `${change >= 0 ? '+' : ''}${Math.abs(change).toFixed(0)}`;
          doc.text(changeText, colX[7] + 3, currentY + 4, { width: colWidths[7] - 6, align: 'right' });
          doc.fillColor('#000000');
          
          doc.y = currentY + rowHeight;
        });
        
        // Table footer border - extended to match wider table
        const tableEndX = colX[colX.length - 1] + colWidths[colWidths.length - 1];
        doc.moveTo(50, doc.y).lineTo(tableEndX, doc.y).stroke('#000000');
        doc.moveDown(0.2);
        doc.fontSize(7).font('Helvetica-Bold');
        doc.text(`Total: ${transactionSteps.length} transactions`, 50, doc.y, { width: tableEndX - 50, align: 'right' });
        doc.font('Helvetica');
      } else {
        doc.fontSize(8).text("No transactions found for this date.", 50, doc.y);
        doc.moveDown(0.2);
      }

      // Compact footer
      doc.moveDown(0.2);
      doc.fontSize(7).fillColor('#666666').text(
        `Generated: ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        { align: "center" }
      );
      doc.fillColor('#000000');

      doc.end();
    } catch (error) {
      logger.error("Error generating PDF:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async generateSalesReportPDF(filters: { startDate?: string; endDate?: string }, res: Response) {
    const report = await this.getSalesReport(filters);
    const settings = await prisma.shopSettings.findFirst();

    const doc = new PDFDocument({ margin: 50 });
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=sales-report-${new Date().toISOString().split("T")[0]}.pdf`);
    }
    doc.pipe(res);

    doc.fontSize(20).text(settings?.shopName || "Isma Sports Complex", { align: "center" });
    doc.moveDown();
    doc.fontSize(16).text("Sales Report", { align: "center" });
    if (filters.startDate && filters.endDate) {
      doc.fontSize(12).text(`${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}`, { align: "center" });
    }
    doc.moveDown(2);

    doc.fontSize(14).text("Summary", { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Total Sales: Rs. ${Number(report.summary.totalSales || 0).toFixed(2)}`);
    doc.text(`Total Bills: ${report.summary.totalBills}`);
    doc.text(`Average Bill: Rs. ${Number(report.summary.averageBill || 0).toFixed(2)}`);

    doc.end();
  }

  async generateExpensesReportPDF(filters: { startDate?: string; endDate?: string }, res: Response) {
    const report = await this.getExpensesReport(filters);
    const settings = await prisma.shopSettings.findFirst();

    const doc = new PDFDocument({ margin: 50 });
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=expenses-report-${new Date().toISOString().split("T")[0]}.pdf`);
    }
    doc.pipe(res);

    doc.fontSize(20).text(settings?.shopName || "Isma Sports Complex", { align: "center" });
    doc.moveDown();
    doc.fontSize(16).text("Expenses Report", { align: "center" });
    if (filters.startDate && filters.endDate) {
      doc.fontSize(12).text(`${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}`, { align: "center" });
    }
    doc.moveDown(2);

    doc.fontSize(14).text("Summary", { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Total Expenses: Rs. ${Number(report.summary.totalExpenses || 0).toFixed(2)}`);

    doc.end();
  }

  async generateProfitLossReportPDF(filters: { startDate?: string; endDate?: string }, res: Response) {
    const report = await this.getProfitLossReport(filters);
    const settings = await prisma.shopSettings.findFirst();

    const doc = new PDFDocument({ margin: 50 });
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=profit-loss-report-${new Date().toISOString().split("T")[0]}.pdf`);
    }
    doc.pipe(res);

    doc.fontSize(20).text(settings?.shopName || "Isma Sports Complex", { align: "center" });
    doc.moveDown();
    doc.fontSize(16).text("Profit & Loss Report", { align: "center" });
    if (filters.startDate && filters.endDate) {
      doc.fontSize(12).text(`${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}`, { align: "center" });
    }
    doc.moveDown(2);

    doc.fontSize(14).text("Financial Summary", { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Total Sales: Rs. ${Number(report.totalSales || 0).toFixed(2)}`);
    doc.text(`Total Expenses: Rs. ${Number(report.totalExpenses || 0).toFixed(2)}`);
    doc.moveDown();
    doc.fontSize(14).text(`Profit: Rs. ${Number(report.profit || 0).toFixed(2)}`, { underline: true });
    doc.text(`Profit Margin: ${Number(report.profitMargin || 0).toFixed(2)}%`);

    doc.end();
  }
}

export default new ReportService();
