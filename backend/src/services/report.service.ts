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
    // Helper function to extract date string (YYYY-MM-DD) from date field/object to avoid timezone issues
    // IMPORTANT: For payment dates (ISO strings with Z), use UTC date components directly - NO timezone conversion
    // Payment dates stored as "2026-01-19T23:22:06.835Z" should be treated as "2026-01-19", not "2026-01-20"
    const extractDateString = (dateValue: Date | string | null | undefined): string | null => {
      if (!dateValue) return null;
      
      if (dateValue instanceof Date) {
        // If it's a Date object, use UTC date components
        const year = dateValue.getUTCFullYear();
        const month = dateValue.getUTCMonth();
        const day = dateValue.getUTCDate();
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      } else {
        // If it's a string, check if it's an ISO string with timezone (ends with Z)
        const dateStr = dateValue.toString();
        if (dateStr.includes('T') && dateStr.endsWith('Z')) {
          // It's a UTC ISO string - extract UTC date components directly (NO timezone conversion)
          const date = new Date(dateStr);
          const year = date.getUTCFullYear();
          const month = date.getUTCMonth();
          const day = date.getUTCDate();
          return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        } else if (dateStr.includes('T') && !dateStr.endsWith('Z')) {
          // ISO string without Z (local timezone) - extract date part directly
          const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (!dateMatch) return null;
          return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
        } else {
          // Simple date string format (YYYY-MM-DD) - extract directly
          const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (!dateMatch) return null;
          return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
        }
      }
    };

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

    // Create a map of balance transactions by sourceId and payment details for quick lookup
    // This helps us add createdAt from balance transactions to purchase/sale rows
    // Key format: "source-sourceId-amount-dateStr" for matching payments
    const balanceTxMapBySourceId = new Map<string, any>();
    transactions.forEach((tx: any) => {
      if (tx.sourceId && (tx.source === "sale_payment" || tx.source === "purchase_payment" || tx.source === "expense")) {
        const txDate = new Date(tx.date || tx.createdAt);
        const { year, month, day } = extractDateComponents(txDate);
        const dateStr = `${year}-${month}-${day}`;
        const amount = Number(tx.amount || 0).toFixed(2);
        
        // Create key with source, sourceId, amount, and date for matching
        const key = `${tx.source}-${tx.sourceId}-${amount}-${dateStr}`;
        
        // Store the first matching transaction (ordered by createdAt ASC)
        if (!balanceTxMapBySourceId.has(key)) {
          balanceTxMapBySourceId.set(key, tx);
        } else {
          // If multiple transactions match, prefer the one with earlier createdAt
          const existing = balanceTxMapBySourceId.get(key)!;
          if (new Date(tx.createdAt).getTime() < new Date(existing.createdAt).getTime()) {
            balanceTxMapBySourceId.set(key, tx);
          }
        }
      }
    });

    // Helper function to get createdAt from balance transactions for a purchase/sale payment
    const getCreatedAtFromBalanceTx = (source: string, sourceId: string, amount: number, paymentDate: Date | string): Date | null => {
      const dateObj = typeof paymentDate === 'string' ? new Date(paymentDate) : paymentDate;
      const { year, month, day } = extractDateComponents(dateObj);
      const dateStr = `${year}-${month}-${day}`;
      const amountStr = Number(amount).toFixed(2);
      const key = `${source}-${sourceId}-${amountStr}-${dateStr}`;
      const balanceTx = balanceTxMapBySourceId.get(key);
      return balanceTx?.createdAt ? new Date(balanceTx.createdAt) : null;
    };

    // Get bank accounts for mapping
    const banks = await prisma.bankAccount.findMany({ where: { isActive: true } });
    const bankMap = new Map(banks.map((b) => [b.id, b]));

    // Build step-by-step transaction list
    const steps: any[] = [];
    
    // Starting balance
    const openingCash = Math.max(0, Number(openingBalance.cashBalance || 0)); // Ensure non-negative
    const openingBankBalances = (openingBalance.bankBalances as Array<{ bankAccountId: string; balance: number }>) || [];
    
    // Calculate total opening balance (cash + sum of all banks)
    const totalBankBalance = openingBankBalances.reduce((sum, b) => sum + Math.max(0, Number(b.balance || 0)), 0);
    const totalOpeningBalance = openingCash + totalBankBalance;
    
    let runningCash = openingCash;
    const runningBankBalances = new Map<string, number>();
    openingBankBalances.forEach((b) => {
      runningBankBalances.set(b.bankAccountId, Math.max(0, Number(b.balance || 0)));
    });

    // Add opening balance step only if total opening balance is greater than 0
    if (totalOpeningBalance > 0) {
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
          balance: Math.max(0, Number(b.balance || 0)), // Ensure non-negative
        })),
        bankBalancesAfter: openingBankBalances.map((b) => ({
          bankAccountId: b.bankAccountId,
          bankName: bankMap.get(b.bankAccountId)?.bankName || "Unknown",
          accountNumber: bankMap.get(b.bankAccountId)?.accountNumber || "",
          balance: Math.max(0, Number(b.balance || 0)), // Ensure non-negative
        })),
        description: "Opening Balance",
        source: "Opening Balance",
      });
    }

    // Process each transaction in chronological order
    let stepNumber = steps.length > 0 ? steps.length + 1 : 1;
    for (const tx of transactions) {
      // IMPORTANT: Skip 'opening_balance' transactions to avoid double counting
      // The opening balance is already set from previous day's closing balance
      // These transactions represent the initial baseline setting and should not be processed again
      if (tx.source === "opening_balance") {
        logger.info(`Skipping opening_balance transaction in report: ${tx.id}, amount=${tx.amount}`);
        continue;
      }
      
      // IMPORTANT: Skip purchase_payment and expense transactions to avoid double counting
      // These will be processed separately from purchases and expenses arrays to ensure correct subtraction
      if (tx.source === "purchase_payment" || tx.source === "expense") {
        logger.info(`Skipping ${tx.source} transaction in report (will process separately): ${tx.id}, amount=${tx.amount}`);
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

    // Filter sales by payment dates (not sale date or createdAt)
    // IMPORTANT: Only use payment.date from payments JSON, NOT sale.date or sale.createdAt
    // IMPORTANT: Only show sales that have payments (payments.length > 0)
    const sales = allSales.filter((sale) => {
      const payments = (sale.payments as Array<{ type?: string; amount?: number; date?: string; cardId?: string; bankAccountId?: string }> | null) || [];
      if (payments.length === 0) {
        // Skip sales with no payments - don't show in daily report
        return false;
      }
      // Check if any payment has a date matching the target date
      // IMPORTANT: Only use payment.date from payments JSON, NOT sale.date
      return payments.some((payment) => {
        if (!payment.date) return false; // Skip payments without date
        // Extract date string using UTC components directly (no timezone conversion)
        const paymentDateStr = extractDateString(payment.date);
        const targetDateStr = formatLocalYMD(startOfDay);
        return paymentDateStr === targetDateStr;
      });
    });

    // Filter purchases by payment dates (not purchase date)
    // Filter purchases by payment dates (not purchase date or createdAt)
    // IMPORTANT: Only use payment.date from payments JSON, NOT purchase.date or purchase.createdAt
    // IMPORTANT: Only show purchases that have payments (payments.length > 0)
    const purchases = allPurchases.filter((purchase) => {
      const payments = (purchase.payments as Array<{ type?: string; amount?: number; date?: string; cardId?: string; bankAccountId?: string }> | null) || [];
      if (payments.length === 0) {
        // Skip purchases with no payments - don't show in daily report
        return false;
      }
      // Check if any payment has a date matching the target date
      // IMPORTANT: Only use payment.date from payments JSON, NOT purchase.date
      return payments.some((payment) => {
        if (!payment.date) return false; // Skip payments without date
        // Extract date string using UTC components directly (no timezone conversion)
        const paymentDateStr = extractDateString(payment.date);
        const targetDateStr = formatLocalYMD(startOfDay);
        return paymentDateStr === targetDateStr;
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

    // Process purchases and expenses to subtract from running balances
    // Note: Sales are already processed in transactions loop (sale_payment), so we skip them here
    // But purchases and expenses need to be subtracted to ensure correct closing balance
    for (const purchase of purchases) {
      const payments = (purchase.payments as Array<{ type?: string; amount?: number; date?: string; bankAccountId?: string }> | null) || [];
      for (const payment of payments) {
        const paymentDateOnly = payment.date ? parsePaymentDate(payment.date) : null;
        if (!paymentDateOnly) {
          const purchaseDate = normalizeDateToNoon(new Date(purchase.date));
          if (purchaseDate.getTime() !== startOfDay.getTime()) continue;
        } else {
          if (paymentDateOnly.getTime() !== startOfDay.getTime()) continue;
        }
        
        const amount = Number(payment.amount || 0);
        const paymentType = payment.type || "cash";
        if (paymentType === "cash") {
          runningCash -= amount;
        } else if (paymentType === "bank_transfer" && payment.bankAccountId) {
          const current = runningBankBalances.get(payment.bankAccountId) || 0;
          runningBankBalances.set(payment.bankAccountId, current - amount);
        }
      }
    }
    
    // Process expenses to subtract from running balances
    for (const expense of filteredExpenses) {
      const amount = Number(expense.amount || 0);
      const paymentType = expense.paymentType || "cash";
      if (paymentType === "cash") {
        runningCash -= amount;
      } else if (paymentType === "bank_transfer" && expense.bankAccountId) {
        const current = runningBankBalances.get(expense.bankAccountId) || 0;
        runningBankBalances.set(expense.bankAccountId, current - amount);
      }
    }
    
    // NOTE: Sales are already processed in the transactions loop above (as sale_payment BalanceTransactions)
    // We don't process sales here to avoid double counting

    // Extract opening balance additions from transactions FIRST
    // Then process them to update running balances BEFORE calculating closing balance
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

    // NOTE: Opening balance additions are already processed in the transactions loop above
    // We don't need to process them again here to avoid double counting
    // The openingBalanceAdditions array is only for display purposes in the report

    // Calculate closing balance AFTER processing all transactions (sales, purchases, expenses)
    // Opening balance additions are already included in the transactions loop
    // IMPORTANT: Always use calculated balance for the report to ensure it matches the transactions shown
    // The stored closing balance might include other transactions or be from a different calculation
    // For the daily report, we want: Opening Balance + Opening Balance Additions + Sales - Purchases - Expenses
    const closingCash = Math.max(0, runningCash); // Ensure non-negative
    const closingBankBalances = Array.from(runningBankBalances.entries()).map(([id, balance]) => ({
      bankAccountId: id,
      bankName: bankMap.get(id)?.bankName || "Unknown",
      accountNumber: bankMap.get(id)?.accountNumber || "",
      balance: Math.max(0, balance), // Ensure non-negative
    }));

    logger.info(`Calculated closing balance for ${date}: cash=${closingCash}, bankTotal=${closingBankBalances.reduce((sum, b) => sum + b.balance, 0)}`);

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
            // Skip sales with no payments - don't include in total
            return sum;
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
              // Skip purchases with no payments - don't include in total
              return sum;
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
              // Skip sales with no payments - don't show in daily report items
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
                    // Get createdAt from balance transactions for this payment
                    const balanceTxCreatedAt = getCreatedAtFromBalanceTx("sale_payment", sale.id, paymentAmount, sale.date);
                    return {
                      ...sale,
                      paymentAmount: paymentAmount,
                      paymentDate: sale.date,
                      paymentType: paymentType,
                      paymentIndex: index,
                      // Use createdAt from balance transactions only, not sale.createdAt
                      // Fallback to sale.date if balance transaction not found
                      createdAt: balanceTxCreatedAt || (sale.date ? new Date(sale.date) : null),
                    };
                  }
                  return null;
                }
                if (paymentDateOnly.getTime() === startOfDay.getTime()) {
                  seenSalePayments.add(paymentKey);
                  // Get createdAt from balance transactions for this payment
                  // IMPORTANT: Preserve UTC time from payment.date (don't convert to local time)
                  const paymentDateForLookup = payment.date ? new Date(payment.date) : new Date(sale.date);
                  const balanceTxCreatedAt = getCreatedAtFromBalanceTx("sale_payment", sale.id, paymentAmount, paymentDateForLookup);
                  let createdAtDate: Date | null = null;
                  if (balanceTxCreatedAt) {
                    createdAtDate = balanceTxCreatedAt;
                  } else if (payment.date) {
                    // Preserve UTC time components from payment.date - treat them as local time (no timezone conversion)
                    // "2026-01-19T23:22:06.835Z" becomes local date 2026-01-19 23:22:06 (not 2026-01-20 04:22:06)
                    const paymentDate = new Date(payment.date);
                    createdAtDate = new Date(
                      paymentDate.getUTCFullYear(),
                      paymentDate.getUTCMonth(),
                      paymentDate.getUTCDate(),
                      paymentDate.getUTCHours(),
                      paymentDate.getUTCMinutes(),
                      paymentDate.getUTCSeconds(),
                      paymentDate.getUTCMilliseconds()
                    );
                  } else if (sale.date) {
                    createdAtDate = new Date(sale.date);
                  }
                  return {
                    ...sale,
                    paymentAmount: paymentAmount,
                    paymentDate: payment.date || sale.date,
                    paymentType: paymentType,
                    paymentIndex: index,
                    // Use createdAt from balance transactions only, not sale.createdAt
                    // Preserve UTC time from payment.date
                    createdAt: createdAtDate,
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
            // Skip sales with no payments - don't include in total
            return sum;
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
            // Skip sales with no payments - don't include in total
            return sum;
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
              // Skip purchases with no payments - don't show in daily report items
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
            // Skip purchases with no payments - don't include in total
            return sum;
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
    // Helper function to extract date string (YYYY-MM-DD) from date field/object to avoid timezone issues
    // IMPORTANT: For payment dates (ISO strings with Z), use UTC date components directly - NO timezone conversion
    // Payment dates stored as "2026-01-19T23:22:06.835Z" should be treated as "2026-01-19", not "2026-01-20"
    const extractDateString = (dateValue: Date | string | null | undefined): string | null => {
      if (!dateValue) return null;
      
      if (dateValue instanceof Date) {
        // If it's a Date object, check if UTC and local dates differ (timezone conversion needed)
        // Use extractDateComponents which handles timezone conversion correctly
        const { year, month, day } = extractDateComponents(dateValue);
        return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      } else {
        // If it's a string, check if it's an ISO string with timezone (ends with Z)
        const dateStr = dateValue.toString();
        if (dateStr.includes('T') && dateStr.endsWith('Z')) {
          // It's a UTC ISO string - extract UTC date components directly (NO timezone conversion)
          // Payment dates like "2026-01-19T23:22:06.835Z" should be treated as "2026-01-19"
          const date = new Date(dateStr);
          // Use UTC date components directly - don't convert to local timezone
          const year = date.getUTCFullYear();
          const month = date.getUTCMonth();
          const day = date.getUTCDate();
          return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        } else if (dateStr.includes('T') && !dateStr.endsWith('Z')) {
          // ISO string without Z (local timezone) - extract date part directly
          const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (!dateMatch) return null;
          return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
        } else {
          // Simple date string format (YYYY-MM-DD) - extract directly
          const dateMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
          if (!dateMatch) return null;
          return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
        }
      }
    };

    // Normalize startDate and endDate to YYYY-MM-DD format if they come in ISO format
    // parseLocalYMD already handles ISO format by splitting on 'T', but we need normalized strings for comparisons
    const normalizedStartDate = extractDateString(startDate) || startDate.split('T')[0];
    const normalizedEndDate = extractDateString(endDate) || endDate.split('T')[0];

    const start = parseLocalYMD(startDate);
    // Use start of day (00:00:00) for start date to capture all transactions from the beginning of the day
    start.setHours(0, 0, 0, 0);
    const end = parseLocalYMD(endDate);
    // Always set end to end of day (23:59:59) to capture all transactions throughout the end date
    end.setHours(23, 59, 59, 999);

    // IMPORTANT: Opening Balance = Previous day's closing balance (baseline only)
    // It should NOT include manual additions made during the date range
    // Always use previous day's closing balance, not the openingBalance record (which might have additions)
    const previousClosing = await dailyClosingBalanceService.getPreviousDayClosingBalance(normalizedStartDate);
    
    let openingBalance: any;
    if (previousClosing) {
      // Use previous day's closing as opening balance for start date (baseline)
      openingBalance = {
        id: `opening-${normalizedStartDate}`,
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
        id: `zero-${normalizedStartDate}`,
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
    // Note: balanceTransactionService.getTransactions already filters by date range
    // But we still need to ensure we only process transactions within the exact date range
    const transactionsRaw = await balanceTransactionService.getTransactions({
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
    });
    
    // IMPORTANT: Filter transactions by date field to ensure only transactions within the date range are included
    // Use date field (not createdAt) for filtering to match the intended transaction date
    // Compare date strings directly (YYYY-MM-DD) to avoid timezone conversion issues
    const transactions = transactionsRaw.filter((tx: any) => {
      if (!tx.date) return false;
      
      // Extract date string (YYYY-MM-DD) from date field to avoid timezone conversion issues
      const txDateStr = extractDateString(tx.date);
      if (!txDateStr) return false;
      
      // Compare date strings directly to avoid timezone conversion issues
      // Use normalized dates for comparison (e.g., "2026-01-19")
      return txDateStr >= normalizedStartDate && txDateStr <= normalizedEndDate;
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

    // Create a map of balance transactions by sourceId and payment details for quick lookup
    // This helps us add createdAt from balance transactions to purchase/sale rows
    // Key format: "source-sourceId-amount-dateStr" for matching payments
    const balanceTxMapBySourceId = new Map<string, any>();
    transactions.forEach((tx: any) => {
      if (tx.sourceId && (tx.source === "sale_payment" || tx.source === "purchase_payment" || tx.source === "expense")) {
        const txDate = new Date(tx.date || tx.createdAt);
        const { year, month, day } = extractDateComponents(txDate);
        const dateStr = `${year}-${month}-${day}`;
        const amount = Number(tx.amount || 0).toFixed(2);
        
        // Create key with source, sourceId, amount, and date for matching
        const key = `${tx.source}-${tx.sourceId}-${amount}-${dateStr}`;
        
        // Store the first matching transaction (ordered by createdAt ASC)
        if (!balanceTxMapBySourceId.has(key)) {
          balanceTxMapBySourceId.set(key, tx);
        } else {
          // If multiple transactions match, prefer the one with earlier createdAt
          const existing = balanceTxMapBySourceId.get(key)!;
          if (new Date(tx.createdAt).getTime() < new Date(existing.createdAt).getTime()) {
            balanceTxMapBySourceId.set(key, tx);
          }
        }
      }
    });

    // Helper function to get createdAt from balance transactions for a purchase/sale payment
    const getCreatedAtFromBalanceTx = (source: string, sourceId: string, amount: number, paymentDate: Date | string): Date | null => {
      const dateObj = typeof paymentDate === 'string' ? new Date(paymentDate) : paymentDate;
      const { year, month, day } = extractDateComponents(dateObj);
      const dateStr = `${year}-${month}-${day}`;
      const amountStr = Number(amount).toFixed(2);
      const key = `${source}-${sourceId}-${amountStr}-${dateStr}`;
      const balanceTx = balanceTxMapBySourceId.get(key);
      return balanceTx?.createdAt ? new Date(balanceTx.createdAt) : null;
    };

    // Get bank accounts
    const banks = await prisma.bankAccount.findMany({ where: { isActive: true } });
    const bankMap = new Map(banks.map((b) => [b.id, b]));

    // Build step-by-step transaction list
    const steps: any[] = [];
    
    const openingCash = Math.max(0, Number(openingBalance.cashBalance || 0)); // Ensure non-negative
    const openingBankBalances = (openingBalance.bankBalances as Array<{ bankAccountId: string; balance: number }>) || [];
    
    // Calculate total opening balance (cash + sum of all banks)
    const totalBankBalance = openingBankBalances.reduce((sum, b) => sum + Math.max(0, Number(b.balance || 0)), 0);
    const totalOpeningBalance = openingCash + totalBankBalance;
    
    let runningCash = openingCash;
    const runningBankBalances = new Map<string, number>();
    openingBankBalances.forEach((b) => {
      runningBankBalances.set(b.bankAccountId, Math.max(0, Number(b.balance || 0)));
    });

    // Add opening balance step only if total opening balance is greater than 0
    if (totalOpeningBalance > 0) {
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
          balance: Math.max(0, Number(b.balance || 0)), // Ensure non-negative
        })),
        bankBalancesAfter: openingBankBalances.map((b) => ({
          bankAccountId: b.bankAccountId,
          bankName: bankMap.get(b.bankAccountId)?.bankName || "Unknown",
          accountNumber: bankMap.get(b.bankAccountId)?.accountNumber || "",
          balance: Math.max(0, Number(b.balance || 0)), // Ensure non-negative
        })),
        description: "Opening Balance",
        source: "Opening Balance",
      });
    }

    // Process transactions
    // Note: transactions array is already filtered by date range above
    let stepNumber = steps.length > 0 ? steps.length + 1 : 1;
    for (const tx of transactions) {
      // IMPORTANT: Skip 'opening_balance' transactions to avoid double counting
      // The opening balance is already set from previous day's closing balance
      // These transactions represent the initial baseline setting and should not be processed again
      if (tx.source === "opening_balance") {
        logger.info(`Skipping opening_balance transaction in date range report: ${tx.id}, amount=${tx.amount}`);
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
    // Fetch all sales and purchases - filter by payment dates in payments JSON array, NOT by createdAt
    // Fetch reasonable range (last 1 year) only for performance, but actual filtering is done by payment dates
    const oneYearAgo = new Date(start.getTime() - 365 * 24 * 60 * 60 * 1000);
    const allSalesForPayments = await prisma.sale.findMany({
      include: { customer: true },
      orderBy: { createdAt: "asc" },
    });

    const allPurchasesForPayments = await prisma.purchase.findMany({
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
    
    for (const tx of transactions) {
      if (tx.source === "sale_payment" || tx.source === "purchase_payment") {
        // Use extractDateString to get consistent date format (YYYY-MM-DD)
        const dateStr = extractDateString(tx.date || tx.createdAt);
        if (!dateStr) continue; // Skip if date can't be extracted
        
        const baseKey = `${tx.source}-${tx.sourceId || ""}`;
        // Count how many transactions we've seen for this purchase/sale
        const count = transactionCounts.get(baseKey) || 0;
        transactionCounts.set(baseKey, count + 1);
        // Include payment index in key to handle multiple payments with same amount/date
        // Use count as index (0-based)
        const key = `${tx.source}-${tx.sourceId || ""}-${Number(tx.amount || 0).toFixed(2)}-${dateStr}-${count}`;
        addedTransactionKeys.add(key);
      }
    }

    // Add sale payments that aren't already in BalanceTransactions
    for (const sale of allSalesForPayments) {
      const payments = (sale.payments as Array<{ type?: string; amount?: number; date?: string; cardId?: string; bankAccountId?: string }> | null) || [];
      for (let paymentIndex = 0; paymentIndex < payments.length; paymentIndex++) {
        const payment = payments[paymentIndex];
        if (!payment.amount || payment.amount <= 0) continue;

        // Check if payment is in date range using string comparison to avoid timezone issues
        // IMPORTANT: Only use payment.date from payments JSON, NOT sale.date or sale.createdAt
        if (!payment.date) continue; // Skip payments without date
        const paymentDateStr = extractDateString(payment.date);
        if (!paymentDateStr || paymentDateStr < normalizedStartDate || paymentDateStr > normalizedEndDate) {
          continue;
        }

        // Check if we already added this from BalanceTransactions
        // Use amount and date to match with BalanceTransaction
        const dateStr = paymentDateStr;
        const amount = Number(payment.amount || 0);
        
        // Check if ANY payment with this sourceId, amount, and date was already added
        // Check all possible indices (0 to a reasonable maximum) to account for counter-based indices
        let alreadyAdded = false;
        const amountStr = amount.toFixed(2);
        const prefix = `sale_payment-${sale.id}-${amountStr}-${dateStr}-`;
        
        // Check all possible indices
        for (let idx = 0; idx < Math.max(payments.length * 2, 50); idx++) {
          if (addedTransactionKeys.has(`${prefix}${idx}`)) {
            alreadyAdded = true;
            break;
          }
        }
        
        if (alreadyAdded) {
          continue; // This payment was already added from BalanceTransactions
        }

        // Only add if payment type is cash, bank_transfer, or card (not credit)
        const paymentType = payment.type || sale.paymentType || "cash";
        if (paymentType === "credit") continue;
        const type = "income";

        // Get payment datetime for steps - use payment date only, not sale.createdAt
        // IMPORTANT: Preserve UTC time from payment.date (don't convert to local timezone)
        // If payment.date is "2026-01-19T23:22:06.835Z", use time 23:22:06 as-is (not 04:22:06)
        const paymentDateForLookup = payment.date || sale.date;
        const balanceTxCreatedAt = getCreatedAtFromBalanceTx("sale_payment", sale.id, amount, paymentDateForLookup);
        // Use payment date with UTC time components treated as local, fallback to sale.date (never use sale.createdAt)
        let paymentDateTime: Date;
        if (balanceTxCreatedAt) {
          paymentDateTime = balanceTxCreatedAt;
        } else if (payment.date) {
          // Preserve UTC time components from payment.date - treat them as local time (no timezone conversion)
          // "2026-01-19T23:22:06.835Z" becomes local date 2026-01-19 23:22:06 (not 2026-01-20 04:22:06)
          const paymentDate = new Date(payment.date);
          paymentDateTime = new Date(
            paymentDate.getFullYear(),
            paymentDate.getMonth(),
            paymentDate.getDate(),
            paymentDate.getHours(),
            paymentDate.getMinutes(),
            paymentDate.getSeconds(),
            paymentDate.getMilliseconds()
          );
        } else if (sale.date) {
          paymentDateTime = new Date(sale.date);
        } else {
          paymentDateTime = new Date();
        }

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

        // Check if payment is in date range using string comparison to avoid timezone issues
        // IMPORTANT: Only use payment.date from payments JSON, NOT purchase.date or purchase.createdAt
        if (!payment.date) continue; // Skip payments without date
        const paymentDateStr = extractDateString(payment.date);
        if (!paymentDateStr || paymentDateStr < normalizedStartDate || paymentDateStr > normalizedEndDate) {
          continue;
        }

        // Check if we already added this from BalanceTransactions
        // Use amount and date to match with BalanceTransaction
        const dateStr = paymentDateStr;
        const amount = Number(payment.amount || 0);
        
        // Check if ANY payment with this sourceId, amount, and date was already added
        // Check all possible indices (0 to a reasonable maximum) to account for counter-based indices
        let alreadyAdded = false;
        const amountStr = amount.toFixed(2);
        const prefix = `purchase_payment-${purchase.id}-${amountStr}-${dateStr}-`;
        
        // Check all possible indices
        for (let idx = 0; idx < Math.max(payments.length * 2, 50); idx++) {
          if (addedTransactionKeys.has(`${prefix}${idx}`)) {
            alreadyAdded = true;
            break;
          }
        }
        
        if (alreadyAdded) {
          continue; // This payment was already added from BalanceTransactions
        }

        const paymentType = payment.type || "cash";
        const type = "expense";

        // Get payment datetime for steps - use payment date only, not purchase.createdAt
        // IMPORTANT: Preserve UTC time from payment.date (don't convert to local timezone)
        // If payment.date is "2026-01-19T23:22:06.835Z", use time 23:22:06 as-is (not 04:22:06)
        const paymentDateForLookup = payment.date || purchase.date;
        const balanceTxCreatedAt = getCreatedAtFromBalanceTx("purchase_payment", purchase.id, amount, paymentDateForLookup);
        // Use payment date with UTC time components treated as local, fallback to purchase.date (never use purchase.createdAt)
        let paymentDateTime: Date;
        if (balanceTxCreatedAt) {
          paymentDateTime = balanceTxCreatedAt;
        } else if (payment.date) {
          // Preserve UTC time components from payment.date - treat them as local time (no timezone conversion)
          // "2026-01-19T23:22:06.835Z" becomes local date 2026-01-19 23:22:06 (not 2026-01-20 04:22:06)
          const paymentDate = new Date(payment.date);
          paymentDateTime = new Date(
            paymentDate.getFullYear(),
            paymentDate.getMonth(),
            paymentDate.getDate(),
            paymentDate.getHours(),
            paymentDate.getMinutes(),
            paymentDate.getSeconds(),
            paymentDate.getMilliseconds()
          );
        } else if (purchase.date) {
          paymentDateTime = new Date(purchase.date);
        } else {
          paymentDateTime = new Date();
        }

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

    // IMPORTANT: For Sales and Purchases, filter by PAYMENT DATES in payments JSON array, NOT by createdAt
    // Fetch all sales and purchases from reasonable range (last 1 year) for performance
    // Actual filtering will be done based on payment dates in payments JSON array below
    const oneYearAgoForRange = new Date(start.getTime() - 365 * 24 * 60 * 60 * 1000);
    const allSalesForRange = await prisma.sale.findMany({
      where: {
        // Fetch from reasonable range for performance only (last 1 year)
        // Actual filtering will be done based on payment dates in payments JSON array below
        createdAt: { gte: oneYearAgoForRange },
      },
      include: { customer: true },
      orderBy: { createdAt: "asc" },
    });

    const allPurchasesForRange = await prisma.purchase.findMany({
      where: {
        // Fetch from reasonable range for performance only (last 1 year)
        // Actual filtering will be done based on payment dates in payments JSON array below
        createdAt: { gte: oneYearAgoForRange },
      },
      include: { supplier: true },
      orderBy: { createdAt: "asc" },
    });

    // Filter sales by payment dates within the range using string comparison to avoid timezone issues
    // IMPORTANT: Only show sales that have payments (payments.length > 0)
    const sales = allSalesForRange.filter((sale) => {
      const payments = (sale.payments as Array<{ type?: string; amount?: number; date?: string; cardId?: string; bankAccountId?: string }> | null) || [];
      if (payments.length === 0) {
        // Skip sales with no payments - don't show in report
        return false;
      }
      // Check if any payment has a date within the range
      // IMPORTANT: Only use payment.date from payments JSON, NOT sale.date or sale.createdAt
      return payments.some((payment) => {
        if (!payment.date) return false; // Only include payments that have a date
        const paymentDateStr = extractDateString(payment.date);
        return paymentDateStr ? paymentDateStr >= normalizedStartDate && paymentDateStr <= normalizedEndDate : false;
      });
    });

    // Filter purchases by payment dates within the range using string comparison to avoid timezone issues
    // IMPORTANT: Only show purchases that have payments (payments.length > 0)
    const purchases = allPurchasesForRange.filter((purchase) => {
      const payments = (purchase.payments as Array<{ type?: string; amount?: number; date?: string; cardId?: string; bankAccountId?: string }> | null) || [];
      if (payments.length === 0) {
        // Skip purchases with no payments - don't show in report
        return false;
      }
      // Check if any payment has a date within the range
      // IMPORTANT: Only use payment.date from payments JSON, NOT purchase.date or purchase.createdAt
      return payments.some((payment) => {
        if (!payment.date) return false; // Only include payments that have a date
        const paymentDateStr = extractDateString(payment.date);
        return paymentDateStr ? paymentDateStr >= normalizedStartDate && paymentDateStr <= normalizedEndDate : false;
      });
    });

    // Expenses use the date field directly (not payment dates)
    // Use string comparison to avoid timezone issues
    const allExpenses = await prisma.expense.findMany({
      orderBy: { createdAt: "asc" },
    });
    
    // Filter expenses by date string comparison to avoid timezone conversion issues
    const expenses = allExpenses.filter((expense) => {
      const expenseDateStr = extractDateString(expense.date);
      return expenseDateStr ? expenseDateStr >= normalizedStartDate && expenseDateStr <= normalizedEndDate : false;
    });

    // Extract opening balance additions from transactions for the date range
    const openingBalanceAdditions = transactions
      .filter((tx: any) => {
        // Include transactions that are opening balance additions (not the initial opening_balance)
        const isAddition = (tx.source === "add_opening_balance" || 
                           (tx.source && tx.source.includes("opening_balance") && tx.source !== "opening_balance"));
        if (!isAddition) return false;
        
        // Check if transaction date is within the range using string comparison to avoid timezone issues
        const txDateStr = extractDateString(tx.date);
        return txDateStr ? txDateStr >= normalizedStartDate && txDateStr <= normalizedEndDate : false;
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

    // Generate daily reports first to get accurate closing balance for each date
    const dailyReports = await this.generateDailyReportsForRange(normalizedStartDate, normalizedEndDate);
    
    // Update summary closing balance to use the last day's closing balance from daily reports
    // This ensures the summary closing balance matches the last day's calculated closing balance
    if (dailyReports.length > 0) {
      const lastDailyReport = dailyReports[dailyReports.length - 1];
      if (lastDailyReport && lastDailyReport.closingBalance) {
        closingCash = Math.max(0, Number(lastDailyReport.closingBalance.cash || 0));
        closingBankBalances = (lastDailyReport.closingBalance.banks || []).map((b: any) => ({
          bankAccountId: b.bankAccountId,
          bankName: bankMap.get(b.bankAccountId)?.bankName || "Unknown",
          accountNumber: bankMap.get(b.bankAccountId)?.accountNumber || "",
          balance: Math.max(0, Number(b.balance || 0)),
        }));
        logger.info(`Updated summary closing balance from last daily report: cash=${closingCash}`);
      }
    }

    return {
      startDate: normalizedStartDate,
      endDate: normalizedEndDate,
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
          // Count sales that have at least one payment in the date range (only payments.length > 0)
          count: allSalesForRange.filter((sale) => {
            const payments = (sale.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
            if (payments.length === 0) {
              // Skip sales with no payments - don't count
              return false;
            }
            return payments.some((payment) => {
              const paymentDateStr = extractDateString(payment.date || sale.date);
              return paymentDateStr ? paymentDateStr >= normalizedStartDate && paymentDateStr <= normalizedEndDate : false;
            });
          }).length,
          // Calculate total from payments that occurred in the date range (only payments.length > 0)
          total: allSalesForRange.reduce((sum, s) => {
            const payments = (s.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
            if (payments.length === 0) {
              // Skip sales with no payments - don't include in total
              return sum;
            }
            // Sum only payments that occurred in the date range
            return sum + payments.reduce((paymentSum, payment) => {
              const paymentDateStr = extractDateString(payment.date || s.date);
              if (paymentDateStr && paymentDateStr >= normalizedStartDate && paymentDateStr <= normalizedEndDate) {
                return paymentSum + Number(payment.amount || 0);
              }
              return paymentSum;
            }, 0);
          }, 0),
        },
        purchases: {
          // Count purchases that have at least one payment in the date range (only payments.length > 0)
          count: allPurchasesForRange.filter((purchase) => {
            const payments = (purchase.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
            if (payments.length === 0) {
              // Skip purchases with no payments - don't count
              return false;
            }
            return payments.some((payment) => {
              const paymentDateStr = extractDateString(payment.date || purchase.date);
              return paymentDateStr ? paymentDateStr >= normalizedStartDate && paymentDateStr <= normalizedEndDate : false;
            });
          }).length,
          // Calculate total from payments that occurred in the date range (only payments.length > 0)
          total: allPurchasesForRange.reduce((sum, p) => {
            const payments = (p.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
            if (payments.length === 0) {
              // Skip purchases with no payments - don't include in total
              return sum;
            }
            // Sum only payments that occurred in the date range
            return sum + payments.reduce((paymentSum, payment) => {
              const paymentDateStr = extractDateString(payment.date || p.date);
              if (paymentDateStr && paymentDateStr >= normalizedStartDate && paymentDateStr <= normalizedEndDate) {
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
        // IMPORTANT: Use allSalesForRange and filter at payment level to ensure only payments in date range are shown
        items: (() => {
          const seenSalePayments = new Set<string>();
          return allSalesForRange.flatMap((sale) => {
            const payments = (sale.payments as Array<{ type?: string; amount?: number; date?: string; cardId?: string; bankAccountId?: string }> | null) || [];
            if (payments.length === 0) {
              // Skip sales with no payments - don't show in report items
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
                
                // Check if payment date is in range using string comparison to avoid timezone issues
                const paymentDateStr = extractDateString(payment.date || sale.date);
                if (!paymentDateStr || paymentDateStr < normalizedStartDate || paymentDateStr > normalizedEndDate) {
                  return null;
                }
                
                seenSalePayments.add(paymentKey);
                // Get createdAt from balance transactions for this payment
                // IMPORTANT: Preserve UTC time from payment.date (don't convert to local time)
                const paymentDateForLookup = payment.date || sale.date;
                const balanceTxCreatedAt = getCreatedAtFromBalanceTx("sale_payment", sale.id, paymentAmount, paymentDateForLookup);
                let createdAtDate: Date | null = null;
                if (balanceTxCreatedAt) {
                  createdAtDate = balanceTxCreatedAt;
                } else if (payment.date) {
                  // Preserve UTC time from payment.date - don't convert to local
                  const paymentDate = new Date(payment.date);
                  createdAtDate = new Date(Date.UTC(
                    paymentDate.getUTCFullYear(),
                    paymentDate.getUTCMonth(),
                    paymentDate.getUTCDate(),
                    paymentDate.getUTCHours(),
                    paymentDate.getUTCMinutes(),
                    paymentDate.getUTCSeconds(),
                    paymentDate.getUTCMilliseconds()
                  ));
                } else if (sale.date) {
                  createdAtDate = new Date(sale.date);
                }
                return {
                  ...sale,
                  paymentAmount: paymentAmount,
                  paymentDate: payment.date || sale.date,
                  paymentType: paymentType,
                  paymentIndex: index,
                  // Use createdAt from balance transactions only, not sale.createdAt
                  // Preserve UTC time from payment.date
                  createdAt: createdAtDate,
                };
              })
              .filter((row) => row !== null);
          });
        })(),
        total: allSalesForRange.reduce((sum, s) => {
          const payments = (s.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
          if (payments.length === 0) {
            // Skip sales with no payments - don't include in total
            return sum;
          }
          return sum + payments.reduce((paymentSum, payment) => {
            const paymentDateStr = extractDateString(payment.date || s.date);
            if (paymentDateStr && paymentDateStr >= normalizedStartDate && paymentDateStr <= normalizedEndDate) {
              return paymentSum + Number(payment.amount || 0);
            }
            return paymentSum;
          }, 0);
        }, 0),
        cash: allSalesForRange.reduce((sum, s) => {
          const payments = (s.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
          const cashPayments = payments.filter(p => p.type === "cash");
          return sum + cashPayments.reduce((paymentSum, payment) => {
            const paymentDateStr = extractDateString(payment.date || s.date);
            if (paymentDateStr && paymentDateStr >= normalizedStartDate && paymentDateStr <= normalizedEndDate) {
              return paymentSum + Number(payment.amount || 0);
            }
            return paymentSum;
          }, 0);
        }, 0),
        bank_transfer: allSalesForRange.reduce((sum, s) => {
          const payments = (s.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
          const bankPayments = payments.filter(p => p.type === "bank_transfer");
          return sum + bankPayments.reduce((paymentSum, payment) => {
            const paymentDateStr = extractDateString(payment.date || s.date);
            if (paymentDateStr && paymentDateStr >= normalizedStartDate && paymentDateStr <= normalizedEndDate) {
              return paymentSum + Number(payment.amount || 0);
            }
            return paymentSum;
          }, 0);
        }, 0),
        card: allSalesForRange.reduce((sum, s) => {
          const payments = (s.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
          const cardPayments = payments.filter(p => p.type === "card");
          return sum + cardPayments.reduce((paymentSum, payment) => {
            const paymentDateStr = extractDateString(payment.date || s.date);
            if (paymentDateStr && paymentDateStr >= normalizedStartDate && paymentDateStr <= normalizedEndDate) {
              return paymentSum + Number(payment.amount || 0);
            }
            return paymentSum;
          }, 0);
        }, 0),
      },
      purchases: {
        // Expand purchases into payment rows - each payment becomes a separate row
        // Use a Set to track seen payment keys (purchase.id + paymentIndex) to prevent duplicates
        // IMPORTANT: Use allPurchasesForRange and filter at payment level to ensure only payments in date range are shown
        items: (() => {
          const seenPurchasePayments = new Set<string>();
          return allPurchasesForRange.flatMap((purchase) => {
            const payments = (purchase.payments as Array<{ type?: string; amount?: number; date?: string; cardId?: string; bankAccountId?: string }> | null) || [];
            if (payments.length === 0) {
              // Skip purchases with no payments - don't show in report items
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
                
                // Check if payment date is in range using string comparison to avoid timezone issues
                const paymentDateStr = extractDateString(payment.date || purchase.date);
                if (!paymentDateStr || paymentDateStr < normalizedStartDate || paymentDateStr > normalizedEndDate) {
                  return null;
                }
                
                seenPurchasePayments.add(paymentKey);
                // Get createdAt from balance transactions for this payment
                // IMPORTANT: Preserve UTC time from payment.date (don't convert to local time)
                const paymentDateForLookup = payment.date || purchase.date;
                const balanceTxCreatedAt = getCreatedAtFromBalanceTx("purchase_payment", purchase.id, paymentAmount, paymentDateForLookup);
                let createdAtDate: Date | null = null;
                if (balanceTxCreatedAt) {
                  createdAtDate = balanceTxCreatedAt;
                } else if (payment.date) {
                  // Preserve UTC time from payment.date - don't convert to local
                  const paymentDate = new Date(payment.date);
                  createdAtDate = new Date(Date.UTC(
                    paymentDate.getUTCFullYear(),
                    paymentDate.getUTCMonth(),
                    paymentDate.getUTCDate(),
                    paymentDate.getUTCHours(),
                    paymentDate.getUTCMinutes(),
                    paymentDate.getUTCSeconds(),
                    paymentDate.getUTCMilliseconds()
                  ));
                } else if (purchase.date) {
                  createdAtDate = new Date(purchase.date);
                }
                return {
                  ...purchase,
                  paymentAmount: paymentAmount,
                  paymentDate: payment.date || purchase.date,
                  paymentType: paymentType,
                  paymentIndex: index,
                  // Use createdAt from balance transactions only, not purchase.createdAt
                  // Preserve UTC time from payment.date
                  createdAt: createdAtDate,
                };
              })
              .filter((row) => row !== null);
          });
        })(),
        total: allPurchasesForRange.reduce((sum, p) => {
          const payments = (p.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
          if (payments.length === 0) {
            // Skip purchases with no payments - don't include in total
            return sum;
          }
          return sum + payments.reduce((paymentSum, payment) => {
            const paymentDateStr = extractDateString(payment.date || p.date);
            if (paymentDateStr && paymentDateStr >= normalizedStartDate && paymentDateStr <= normalizedEndDate) {
              return paymentSum + Number(payment.amount || 0);
            }
            return paymentSum;
          }, 0);
        }, 0),
        cash: allPurchasesForRange.reduce((sum, p) => {
          const payments = (p.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
          const cashPayments = payments.filter(pay => pay.type === "cash");
          return sum + cashPayments.reduce((paymentSum, payment) => {
            const paymentDateStr = extractDateString(payment.date || p.date);
            if (paymentDateStr && paymentDateStr >= normalizedStartDate && paymentDateStr <= normalizedEndDate) {
              return paymentSum + Number(payment.amount || 0);
            }
            return paymentSum;
          }, 0);
        }, 0),
        bank_transfer: allPurchasesForRange.reduce((sum, p) => {
          const payments = (p.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
          const bankPayments = payments.filter(pay => pay.type === "bank_transfer");
          return sum + bankPayments.reduce((paymentSum, payment) => {
            const paymentDateStr = extractDateString(payment.date || p.date);
            if (paymentDateStr && paymentDateStr >= normalizedStartDate && paymentDateStr <= normalizedEndDate) {
              return paymentSum + Number(payment.amount || 0);
            }
            return paymentSum;
          }, 0);
        }, 0),
        card: allPurchasesForRange.reduce((sum, p) => {
          const payments = (p.payments as Array<{ type?: string; amount?: number; date?: string }> | null) || [];
          const cardPayments = payments.filter(pay => pay.type === "card");
          return sum + cardPayments.reduce((paymentSum, payment) => {
            const paymentDateStr = extractDateString(payment.date || p.date);
            if (paymentDateStr && paymentDateStr >= normalizedStartDate && paymentDateStr <= normalizedEndDate) {
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
      dailyReports: await this.generateDailyReportsForRange(normalizedStartDate, normalizedEndDate),
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
