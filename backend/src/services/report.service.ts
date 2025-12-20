import prisma from "../config/database";
import logger from "../utils/logger";
import PDFDocument from "pdfkit";
import { Response } from "express";

class ReportService {
  async getSalesReport(filters: { startDate?: string; endDate?: string }) {
    const where: any = { status: "completed" };

    if (filters.startDate && filters.endDate) {
      where.createdAt = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate),
      };
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        items: true,
        customer: true,
      },
      orderBy: { createdAt: "desc" },
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
      where.date = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate),
      };
    }

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

    // Group by category
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
      dateFilter.gte = new Date(filters.startDate);
      dateFilter.lte = new Date(filters.endDate);
    }

    // Get sales
    const sales = await prisma.sale.findMany({
      where: {
        status: "completed",
        createdAt: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
      },
      orderBy: { createdAt: "desc" },
    });

    // Get expenses
    const expenses = await prisma.expense.findMany({
      where: {
        date: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
      },
      orderBy: { createdAt: "desc" },
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

  async generateSalesReportPDF(filters: { startDate?: string; endDate?: string }, res: Response) {
    const report = await this.getSalesReport(filters);
    const settings = await prisma.shopSettings.findFirst();

    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=sales-report-${new Date().toISOString().split("T")[0]}.pdf`
    );

    doc.pipe(res);

    // Header
    doc.fontSize(20).text(settings?.shopName || "Isma Sports Complex", { align: "center" });
    doc.moveDown();
    doc.fontSize(16).text("Sales Report", { align: "center" });
    if (filters.startDate && filters.endDate) {
      doc.fontSize(12).text(
        `${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}`,
        { align: "center" }
      );
    }
    doc.moveDown(2);

    // Summary
    doc.fontSize(14).text("Summary", { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Total Sales: Rs. ${report.summary.totalSales.toFixed(2)}`);
    doc.text(`Total Bills: ${report.summary.totalBills}`);
    doc.text(`Average Bill: Rs. ${report.summary.averageBill.toFixed(2)}`);
    doc.moveDown(2);

    // Sales Details
    if (report.sales.length > 0) {
      doc.fontSize(14).text("Sales Details", { underline: true });
      doc.moveDown();

      report.sales.forEach((sale, index) => {
        doc.fontSize(11).text(`${index + 1}. Bill #${sale.billNumber}`, { continued: true });
        doc.text(` - Rs. ${Number(sale.total).toFixed(2)}`, { align: "right" });
        doc.fontSize(9).text(`   Customer: ${sale.customerName} | Date: ${new Date(sale.createdAt).toLocaleDateString()}`);
        doc.moveDown(0.5);
      });
    } else {
      doc.fontSize(12).text("No sales found for the selected period.");
    }

    doc.end();
  }

  async generateExpensesReportPDF(filters: { startDate?: string; endDate?: string }, res: Response) {
    const report = await this.getExpensesReport(filters);
    const settings = await prisma.shopSettings.findFirst();

    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=expenses-report-${new Date().toISOString().split("T")[0]}.pdf`
    );

    doc.pipe(res);

    // Header
    doc.fontSize(20).text(settings?.shopName || "Isma Sports Complex", { align: "center" });
    doc.moveDown();
    doc.fontSize(16).text("Expenses Report", { align: "center" });
    if (filters.startDate && filters.endDate) {
      doc.fontSize(12).text(
        `${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}`,
        { align: "center" }
      );
    }
    doc.moveDown(2);

    // Summary
    doc.fontSize(14).text("Summary", { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Total Expenses: Rs. ${report.summary.totalExpenses.toFixed(2)}`);
    doc.moveDown();

    // Category Breakdown
    if (Object.keys(report.summary.categoryTotals).length > 0) {
      doc.fontSize(14).text("Category Breakdown", { underline: true });
      doc.moveDown();
      Object.entries(report.summary.categoryTotals).forEach(([category, total]) => {
        doc.fontSize(11).text(`${category}: Rs. ${total.toFixed(2)}`);
      });
      doc.moveDown(2);
    }

    // Expense Details
    if (report.expenses.length > 0) {
      doc.fontSize(14).text("Expense Details", { underline: true });
      doc.moveDown();

      report.expenses.forEach((expense, index) => {
        doc.fontSize(11).text(`${index + 1}. ${expense.description}`, { continued: true });
        doc.text(`Rs. ${Number(expense.amount).toFixed(2)}`, { align: "right" });
        doc.fontSize(9).text(`   Category: ${expense.category} | Date: ${new Date(expense.date).toLocaleDateString()}`);
        doc.moveDown(0.5);
      });
    } else {
      doc.fontSize(12).text("No expenses found for the selected period.");
    }

    doc.end();
  }

  async generateProfitLossReportPDF(filters: { startDate?: string; endDate?: string }, res: Response) {
    const report = await this.getProfitLossReport(filters);
    const settings = await prisma.shopSettings.findFirst();

    const doc = new PDFDocument({ margin: 50 });
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=profit-loss-report-${new Date().toISOString().split("T")[0]}.pdf`
    );

    doc.pipe(res);

    // Header
    doc.fontSize(20).text(settings?.shopName || "Isma Sports Complex", { align: "center" });
    doc.moveDown();
    doc.fontSize(16).text("Profit & Loss Report", { align: "center" });
    if (filters.startDate && filters.endDate) {
      doc.fontSize(12).text(
        `${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}`,
        { align: "center" }
      );
    }
    doc.moveDown(2);

    // Summary
    doc.fontSize(14).text("Financial Summary", { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Total Sales: Rs. ${report.totalSales.toFixed(2)}`);
    doc.text(`Total Expenses: Rs. ${report.totalExpenses.toFixed(2)}`);
    doc.moveDown();
    doc.fontSize(14).text(`Profit: Rs. ${report.profit.toFixed(2)}`, { underline: true });
    doc.text(`Profit Margin: ${report.profitMargin.toFixed(2)}%`);

    doc.end();
  }

  async getDailyReport(date: string) {
    // Parse date string (YYYY-MM-DD) properly to avoid timezone issues
    logger.info(`Getting daily report for date: ${date}`);
    const dateParts = date.split("-");
    if (dateParts.length !== 3) {
      throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
    }
    const targetDate = new Date(
      parseInt(dateParts[0]), 
      parseInt(dateParts[1]) - 1, 
      parseInt(dateParts[2])
    );
    targetDate.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);
    nextDate.setHours(0, 0, 0, 0);
    
    logger.info(`Target date range: ${targetDate.toISOString()} to ${nextDate.toISOString()}`);

    // Get opening balance - should be previous day's closing balance
    // Use the same logic as frontend opening balance page
    const dailyClosingBalanceService = (await import("./dailyClosingBalance.service")).default;
    
    let openingCash = 0;
    let openingBankBalances: Array<{ bankAccountId: string; balance: number }> = [];
    let openingCardBalances: Array<{ cardId: string; balance: number }> = [];
    
    try {
      // First try to get previous day's closing balance (same as frontend)
      logger.info(`Attempting to get previous day closing balance for ${date}`);
      const prevClosing = await dailyClosingBalanceService.getPreviousDayClosingBalance(date);
      if (prevClosing) {
        openingCash = Number(prevClosing.cashBalance || 0);
        openingBankBalances = (prevClosing.bankBalances as any[]) || [];
        openingCardBalances = (prevClosing.cardBalances as any[]) || [];
        logger.info(`Got previous day closing balance: Cash=${openingCash}, Banks=${openingBankBalances.length}, Cards=${openingCardBalances.length}`);
      } else {
        logger.info(`No previous day closing balance found for ${date}`);
      }
    } catch (e) {
      logger.warn(`Error getting previous day closing balance: ${e}`);
      // If no previous closing, try to get opening balance record for this date
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);
      
      try {
        const openingBalance = await prisma.dailyOpeningBalance.findFirst({
          where: {
            date: {
              gte: targetDate,
              lte: endOfDay,
            },
          },
          orderBy: { createdAt: "desc" },
        });
        
        if (openingBalance) {
          openingCash = Number(openingBalance.cashBalance || 0);
          openingBankBalances = (openingBalance.bankBalances as any[]) || [];
          openingCardBalances = (openingBalance.cardBalances as any[]) || [];
          logger.info(`Got opening balance record: Cash=${openingCash}, Banks=${openingBankBalances.length}, Cards=${openingCardBalances.length}`);
        } else {
          logger.info(`No opening balance record found for ${date}`);
        }
      } catch (err) {
        logger.error(`Error fetching opening balance record: ${err}`);
      }
    }

    // Get all cards and banks for mapping
    const cards = await prisma.card.findMany();
    const cardMap = new Map(cards.map((card) => [card.id, card]));
    const banks = await prisma.bankAccount.findMany();
    const bankMap = new Map(banks.map((bank) => [bank.id, bank]));

    // Calculate opening balance totals
    const openingCards = openingCardBalances.map((cb) => {
      const card = cardMap.get(cb.cardId);
      return {
        cardId: cb.cardId,
        cardName: card?.name || "Unknown",
        balance: Number(cb.balance),
      };
    });
    const openingCardTotal = openingCards.reduce((sum, card) => sum + card.balance, 0);
    const openingBankTotal = openingBankBalances.reduce((sum, bank) => sum + Number(bank.balance || 0), 0);

    // Get sales for the day - simple query like opening balance
    // Query sales where date field matches target date (similar to opening balance pattern)
    const sales = await prisma.sale.findMany({
      where: {
        status: "completed",
        date: {
          gte: targetDate,
          lt: nextDate,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        customer: true,
      },
      orderBy: { createdAt: "asc" },
    });

    logger.info(`Found ${sales.length} sales for ${date}`);

    // Calculate sales totals - count ALL payments for sales on this date
    let salesTotal = 0;
    let salesCash = 0;
    let salesBankTransfer = 0;
    let salesCard = 0;
    
    sales.forEach((sale) => {
      const payments = (sale.payments as Array<{ 
        type: string; 
        amount: number; 
        date?: string;
        cardId?: string; 
        bankAccountId?: string 
      }> | null) || [];
      
      if (payments.length > 0) {
        // Count all payments for this sale
        payments.forEach((payment) => {
          const amount = Number(payment.amount || 0);
          salesTotal += amount;
          
          if (payment.type === "cash") {
            salesCash += amount;
          } else if (payment.type === "bank_transfer") {
            salesBankTransfer += amount;
          } else if (payment.type === "card") {
            salesCard += amount;
          }
        });
      } else {
        // No payments array - assume full amount was paid using paymentType
        // This handles legacy sales without payments array
        const amount = Number(sale.total || 0);
        salesTotal += amount;
        
        if (sale.paymentType === "cash") {
          salesCash += amount;
        } else if (sale.paymentType === "bank_transfer") {
          salesBankTransfer += amount;
        }
      }
    });

    logger.info(`Sales totals for ${date}: Total=${salesTotal}, Cash=${salesCash}, Bank=${salesBankTransfer}, Card=${salesCard}`);

    // Get purchases for the day - simple query like opening balance
    const purchases = await prisma.purchase.findMany({
      where: {
        status: "completed",
        date: {
          gte: targetDate,
          lt: nextDate,
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        supplier: true,
      },
      orderBy: { createdAt: "asc" },
    });
    
    logger.info(`Found ${purchases.length} purchases for ${date}`);

    // Calculate purchase totals
    const purchasesTotal = purchases.reduce((sum, p) => sum + Number(p.total), 0);
    const purchasesCash = purchases
      .filter((p) => {
        const payments = (p.payments as Array<{ type: string; amount: number }> | null) || [];
        return payments.some((pay) => pay.type === "cash");
      })
      .reduce((sum, p) => {
        const payments = (p.payments as Array<{ type: string; amount: number }> | null) || [];
        const cashPayments = payments.filter((pay) => pay.type === "cash").reduce((s, pay) => s + pay.amount, 0);
        return sum + cashPayments;
      }, 0);
    const purchasesBankTransfer = purchases
      .filter((p) => {
        const payments = (p.payments as Array<{ type: string; amount: number }> | null) || [];
        return payments.some((pay) => pay.type === "bank_transfer");
      })
      .reduce((sum, p) => {
        const payments = (p.payments as Array<{ type: string; amount: number }> | null) || [];
        const bankTransferPayments = payments.filter((pay) => pay.type === "bank_transfer").reduce((s, pay) => s + pay.amount, 0);
        return sum + bankTransferPayments;
      }, 0);

    // Get expenses for the day - check both date field and createdAt
    const expenses = await prisma.expense.findMany({
      where: {
        OR: [
          {
            date: {
              gte: targetDate,
              lt: nextDate,
            },
          },
          {
            createdAt: {
              gte: targetDate,
              lt: nextDate,
            },
          },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    logger.info(`Found ${expenses.length} expenses for ${date}`);

    // Calculate expense totals
    const expensesTotal = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    const expensesCash = expenses.filter((e) => e.paymentType === "cash").reduce((sum, exp) => sum + Number(exp.amount), 0);
    const expensesBankTransfer = expenses.filter((e) => e.paymentType === "bank_transfer").reduce((sum, exp) => sum + Number(exp.amount), 0);

    // Calculate closing balance
    const closingCash = openingCash + salesCash - purchasesCash - expensesCash;
    
    // Calculate closing card balances (using payments JSON for sales/purchases, and cardId for expenses)
    const getCardPayments = (payments: any, cardId: string) => {
      const list = (payments as Array<{ type?: string; amount?: number; cardId?: string }> | null) || [];
      return list
        .filter((p) => p.type === "card" && (!cardId || p.cardId === cardId))
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    };

    const closingCardBalances = openingCardBalances.map((cb) => {
      const card = cardMap.get(cb.cardId);
      if (!card) return { cardId: cb.cardId, cardName: "Unknown", balance: Number(cb.balance) };
      
      // Add card sales from payments JSON, subtract card purchases (payments JSON) and card expenses (by cardId)
      const cardSales = sales.reduce((sum, sale) => sum + getCardPayments((sale as any).payments, cb.cardId), 0);
      const cardPurchases = purchases.reduce((sum, p) => sum + getCardPayments(p.payments, cb.cardId), 0);
      const cardExpenses = expenses.reduce(
        (sum, exp) => sum + (exp.cardId === cb.cardId ? Number(exp.amount) : 0),
        0
      );
      
      return {
        cardId: cb.cardId,
        cardName: card.name,
        balance: Number(cb.balance) + cardSales - cardPurchases - cardExpenses,
      };
    });
    
    const closingCardTotal = closingCardBalances.reduce((sum, card) => sum + card.balance, 0);

    // Get opening balance additions (transactions where source is "add_opening_balance")
    const balanceTransactionService = (await import("./balanceTransaction.service")).default;
    let openingBalanceAdditions: any[] = [];
    try {
      const transactions = await balanceTransactionService.getTransactions({
        startDate: date,
        endDate: date,
      });
      openingBalanceAdditions = transactions
        .filter((t) => t.source === "add_opening_balance" || t.source === "opening_balance" || t.transactionType === "add_opening_balance")
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } catch (e) {
      logger.error("Error fetching opening balance additions:", e);
    }
    
    // Log for debugging
    logger.info(`Daily Report for ${date}: Sales: ${sales.length}, Purchases: ${purchases.length}, Expenses: ${expenses.length}, Opening Additions: ${openingBalanceAdditions.length}`);

    // Calculate closing balance with bank transfers
    const closingBankBalances = openingBankBalances.map((bank) => {
      const bankSales = sales.reduce((sum, sale) => {
        const payments = (sale.payments as Array<{ type: string; amount: number; bankAccountId?: string; date?: string }> | null) || [];
        return sum + payments
          .filter((p) => p.type === "bank_transfer" && p.bankAccountId === bank.bankAccountId)
          .reduce((s, p) => s + Number(p.amount || 0), 0);
      }, 0);
      
      const bankPurchases = purchases.reduce((sum, p) => {
        const payments = (p.payments as Array<{ type: string; amount: number; bankAccountId?: string; date?: string }> | null) || [];
        return sum + payments
          .filter((pay) => pay.type === "bank_transfer" && pay.bankAccountId === bank.bankAccountId)
          .reduce((s, pay) => s + Number(pay.amount || 0), 0);
      }, 0);
      
      const bankExpenses = expenses
        .filter((e) => e.paymentType === "bank_transfer" && e.bankAccountId === bank.bankAccountId)
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);
      
      return {
        bankAccountId: bank.bankAccountId,
        bankName: bankMap.get(bank.bankAccountId)?.bankName || "Unknown",
        accountNumber: bankMap.get(bank.bankAccountId)?.accountNumber || "",
        balance: Number(bank.balance || 0) + bankSales - bankPurchases - bankExpenses,
      };
    });

    const closingBankTotal = closingBankBalances.reduce((sum, bank) => sum + bank.balance, 0);

    // Comprehensive logging for debugging
    logger.info(`=== Daily Report Summary for ${date} ===`);
    logger.info(`Opening Balance: Cash=${openingCash}, Banks=${openingBankTotal}, Cards=${openingCardTotal}, Total=${openingCash + openingBankTotal + openingCardTotal}`);
    logger.info(`Sales: Total=${salesTotal}, Cash=${salesCash}, Bank=${salesBankTransfer}, Card=${salesCard}, Count=${sales.length}`);
    logger.info(`Purchases: Total=${purchasesTotal}, Cash=${purchasesCash}, Bank=${purchasesBankTransfer}, Count=${purchases.length}`);
    logger.info(`Expenses: Total=${expensesTotal}, Cash=${expensesCash}, Bank=${expensesBankTransfer}, Count=${expenses.length}`);
    logger.info(`Closing Balance: Cash=${closingCash}, Banks=${closingBankTotal}, Cards=${closingCardTotal}, Total=${closingCash + closingBankTotal + closingCardTotal}`);
    logger.info(`Opening Balance Additions: ${openingBalanceAdditions.length}`);

    return {
      date: date,
      openingBalance: {
        cash: openingCash,
        banks: openingBankBalances.map(b => ({ bankAccountId: b.bankAccountId, balance: b.balance })),
        cards: openingCards,
        total: openingCash + openingBankTotal + openingCardTotal,
      },
      openingBalanceAdditions: openingBalanceAdditions.map((t) => ({
        id: t.id,
        time: t.createdAt,
        type: t.type,
        amount: Number(t.amount),
        paymentType: t.paymentType,
        bankAccountId: t.bankAccountId,
        bankAccount: t.bankAccount,
        description: t.description,
        userName: t.userName,
      })),
      sales: {
        total: salesTotal,
        cash: salesCash,
        bank_transfer: salesBankTransfer,
        card: salesCard,
        credit: sales.reduce((sum, sale) => {
          const payments = (sale.payments as Array<{ type: string; amount: number }> | null) || [];
          const paidAmount = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
          return sum + (Number(sale.total || 0) - paidAmount);
        }, 0),
        count: sales.length,
        items: sales,
      },
      purchases: {
        total: purchasesTotal,
        cash: purchasesCash,
        bank_transfer: purchasesBankTransfer,
        count: purchases.length,
        items: purchases,
      },
      expenses: {
        total: expensesTotal,
        cash: expensesCash,
        bank_transfer: expensesBankTransfer,
        count: expenses.length,
        items: expenses,
      },
      closingBalance: {
        cash: closingCash,
        banks: closingBankBalances,
        cards: closingCardBalances,
        total: closingCash + closingBankTotal + closingCardTotal,
      },
    };
  }

  /**
   * Generate comprehensive daily report PDF with chronological order
   */
  async generateDailyReportPDF(date: string, res: Response) {
    const report = await this.getDailyReport(date);
    const settings = await prisma.shopSettings.findFirst();

    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=daily-report-${date}.pdf`
    );

    doc.pipe(res);

    // Header
    doc.fontSize(20).text(settings?.shopName || "Isma Sports Complex", { align: "center" });
    doc.moveDown();
    doc.fontSize(16).text("Daily Financial Report", { align: "center" });
    doc.fontSize(12).text(`Date: ${new Date(date).toLocaleDateString()}`, { align: "center" });
    doc.moveDown(2);

    // Opening Balance Section
    doc.fontSize(14).text("1. Opening Balance", { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Cash: Rs. ${report.openingBalance.cash.toFixed(2)}`);
    if (report.openingBalance.banks && report.openingBalance.banks.length > 0) {
      report.openingBalance.banks.forEach((bank: any) => {
        const bankName = bank.bankName || "Bank";
        doc.text(`${bankName}: Rs. ${Number(bank.balance || 0).toFixed(2)}`);
      });
    }
    if (report.openingBalance.cards && report.openingBalance.cards.length > 0) {
      report.openingBalance.cards.forEach((card: any) => {
        doc.text(`Card (${card.cardName}): Rs. ${card.balance.toFixed(2)}`);
      });
    }
    doc.text(`Total Opening Balance: Rs. ${report.openingBalance.total.toFixed(2)}`);
    doc.moveDown(2);

    // Opening Balance Additions (chronological)
    if (report.openingBalanceAdditions && report.openingBalanceAdditions.length > 0) {
      doc.fontSize(14).text("2. Opening Balance Additions", { underline: true });
      doc.moveDown();
      report.openingBalanceAdditions.forEach((addition: any, index: number) => {
        const time = new Date(addition.time).toLocaleTimeString();
        const type = addition.paymentType === "cash" ? "Cash" : addition.bankAccount?.bankName || "Bank";
        doc.fontSize(11).text(
          `${index + 1}. ${time} - Added ${type}: Rs. ${addition.amount.toFixed(2)}`,
          { indent: 20 }
        );
        if (addition.description) {
          doc.fontSize(9).text(`   ${addition.description}`, { indent: 20 });
        }
      });
      doc.moveDown(2);
    }

    // Purchases (chronological)
    if (report.purchases.items && report.purchases.items.length > 0) {
      doc.fontSize(14).text("3. Purchases", { underline: true });
      doc.moveDown();
      report.purchases.items.forEach((purchase: any, index: number) => {
        const time = new Date(purchase.createdAt).toLocaleTimeString();
        doc.fontSize(11).text(
          `${index + 1}. ${time} - Purchase #${purchase.id.substring(0, 8)}: Rs. ${Number(purchase.total).toFixed(2)}`,
          { indent: 20 }
        );
        doc.fontSize(9).text(`   Supplier: ${purchase.supplierName || "N/A"}`, { indent: 20 });
        const payments = (purchase.payments as Array<{ type: string; amount: number }> | null) || [];
        if (payments.length > 0) {
          payments.forEach((p: any) => {
            doc.fontSize(9).text(`   Payment: ${p.type.toUpperCase()} - Rs. ${Number(p.amount || 0).toFixed(2)}`, { indent: 20 });
          });
        }
      });
      doc.text(`Total Purchases: Rs. ${report.purchases.total.toFixed(2)}`);
      doc.moveDown(2);
    }

    // Sales (chronological)
    if (report.sales.items && report.sales.items.length > 0) {
      doc.fontSize(14).text("4. Sales", { underline: true });
      doc.moveDown();
      report.sales.items.forEach((sale: any, index: number) => {
        const time = new Date(sale.createdAt).toLocaleTimeString();
        doc.fontSize(11).text(
          `${index + 1}. ${time} - Bill #${sale.billNumber}: Rs. ${Number(sale.total).toFixed(2)}`,
          { indent: 20 }
        );
        doc.fontSize(9).text(`   Customer: ${sale.customerName || "Walk-in"}`, { indent: 20 });
        const payments = (sale.payments as Array<{ type: string; amount: number; date?: string }> | null) || [];
        if (payments.length > 0) {
          payments.forEach((p: any) => {
            const paymentDate = p.date ? new Date(p.date).toLocaleDateString() : "";
            doc.fontSize(9).text(
              `   Payment: ${p.type.toUpperCase()} - Rs. ${Number(p.amount || 0).toFixed(2)}${paymentDate ? ` (${paymentDate})` : ""}`,
              { indent: 20 }
            );
          });
        }
      });
      doc.text(`Total Sales: Rs. ${report.sales.total.toFixed(2)}`);
      doc.moveDown(2);
    }

    // Expenses (chronological)
    if (report.expenses.items && report.expenses.items.length > 0) {
      doc.fontSize(14).text("5. Expenses", { underline: true });
      doc.moveDown();
      report.expenses.items.forEach((expense: any, index: number) => {
        const time = new Date(expense.createdAt).toLocaleTimeString();
        doc.fontSize(11).text(
          `${index + 1}. ${time} - ${expense.category}: Rs. ${Number(expense.amount).toFixed(2)}`,
          { indent: 20 }
        );
        if (expense.description) {
          doc.fontSize(9).text(`   ${expense.description}`, { indent: 20 });
        }
        doc.fontSize(9).text(`   Payment: ${expense.paymentType.toUpperCase()}`, { indent: 20 });
      });
      doc.text(`Total Expenses: Rs. ${report.expenses.total.toFixed(2)}`);
      doc.moveDown(2);
    }

    // Closing Balance Section
    doc.fontSize(14).text("6. Closing Balance", { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Cash: Rs. ${report.closingBalance.cash.toFixed(2)}`);
    if (report.closingBalance.banks && report.closingBalance.banks.length > 0) {
      report.closingBalance.banks.forEach((bank: any) => {
        doc.text(`${bank.bankName}: Rs. ${Number(bank.balance || 0).toFixed(2)}`);
      });
    }
    if (report.closingBalance.cards && report.closingBalance.cards.length > 0) {
      report.closingBalance.cards.forEach((card: any) => {
        doc.text(`Card (${card.cardName}): Rs. ${card.balance.toFixed(2)}`);
      });
    }
    doc.text(`Total Closing Balance: Rs. ${report.closingBalance.total.toFixed(2)}`);
    doc.moveDown(2);

    // Summary
    doc.fontSize(14).text("Summary", { underline: true });
    doc.moveDown();
    doc.fontSize(12).text(`Opening Balance: Rs. ${report.openingBalance.total.toFixed(2)}`);
    doc.text(`Total Sales: Rs. ${report.sales.total.toFixed(2)}`);
    doc.text(`Total Purchases: Rs. ${report.purchases.total.toFixed(2)}`);
    doc.text(`Total Expenses: Rs. ${report.expenses.total.toFixed(2)}`);
    doc.text(`Closing Balance: Rs. ${report.closingBalance.total.toFixed(2)}`);
    
    const netChange = report.closingBalance.total - report.openingBalance.total;
    doc.fontSize(12).text(
      `Net Change: ${netChange >= 0 ? "+" : ""}Rs. ${netChange.toFixed(2)}`,
      { color: netChange >= 0 ? "green" : "red" }
    );

    doc.end();
  }

  async getDateRangeReport(startDate: string, endDate: string) {
    // Parse dates properly to avoid timezone issues
    const startParts = startDate.split("-");
    const start = new Date(
      parseInt(startParts[0]), 
      parseInt(startParts[1]) - 1, 
      parseInt(startParts[2])
    );
    start.setHours(0, 0, 0, 0);
    
    const endParts = endDate.split("-");
    const end = new Date(
      parseInt(endParts[0]), 
      parseInt(endParts[1]) - 1, 
      parseInt(endParts[2])
    );
    end.setHours(23, 59, 59, 999);

    // Get opening balance for start date (most recent for the date)
    const startEndOfDay = new Date(start);
    startEndOfDay.setHours(23, 59, 59, 999);
    
    const openingBalance = await prisma.dailyOpeningBalance.findFirst({
      where: {
        date: {
          gte: start,
          lte: startEndOfDay,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get all cards for mapping
    const cards = await prisma.card.findMany();
    const cardMap = new Map(cards.map((card) => [card.id, card]));

    // Calculate opening balance totals
    const openingCardBalances = (openingBalance?.cardBalances as Array<{ cardId: string; balance: number }> | null) || [];
    const openingCards = openingCardBalances.map((cb) => {
      const card = cardMap.get(cb.cardId);
      return {
        cardId: cb.cardId,
        cardName: card?.name || "Unknown",
        balance: Number(cb.balance),
      };
    });
    const openingCardTotal = openingCards.reduce((sum, card) => sum + card.balance, 0);
    const openingCash = Number(openingBalance?.cashBalance || 0);

    // Get all sales in range
    const sales = await prisma.sale.findMany({
      where: {
        status: "completed",
        createdAt: {
          gte: start,
          lte: end,
        },
      },
      include: {
        items: true,
        customer: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Get all purchases in range
    const purchases = await prisma.purchase.findMany({
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Get all expenses in range
    const expenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate summary totals - combine multiple payments for same sale
    const salesTotal = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
    
    // Calculate cash and bank transfer from payments array (combine multiple payments)
    let salesCash = 0;
    let salesBankTransfer = 0;
    let salesCard = 0;
    
    sales.forEach((sale) => {
      const payments = (sale.payments as Array<{ type: string; amount: number; cardId?: string; bankAccountId?: string }> | null) || [];
      if (payments.length > 0) {
        // Use payments array if available
        payments.forEach((payment) => {
          if (payment.type === "cash") {
            salesCash += Number(payment.amount || 0);
          } else if (payment.type === "bank_transfer") {
            salesBankTransfer += Number(payment.amount || 0);
          } else if (payment.type === "card") {
            salesCard += Number(payment.amount || 0);
          }
        });
      } else {
        // Fallback to paymentType if payments array is not available
        if (sale.paymentType === "cash") {
          salesCash += Number(sale.total);
        } else if (sale.paymentType === "bank_transfer") {
          salesBankTransfer += Number(sale.total);
        }
      }
    });

    const purchasesTotal = purchases.reduce((sum, p) => sum + Number(p.total), 0);
    const purchasesCash = purchases
      .filter((p) => {
        const payments = (p.payments as Array<{ type: string; amount: number }> | null) || [];
        return payments.some((pay) => pay.type === "cash");
      })
      .reduce((sum, p) => {
        const payments = (p.payments as Array<{ type: string; amount: number }> | null) || [];
        const cashPayments = payments.filter((pay) => pay.type === "cash").reduce((s, pay) => s + pay.amount, 0);
        return sum + cashPayments;
      }, 0);
    const purchasesBankTransfer = purchases
      .filter((p) => {
        const payments = (p.payments as Array<{ type: string; amount: number }> | null) || [];
        return payments.some((pay) => pay.type === "bank_transfer");
      })
      .reduce((sum, p) => {
        const payments = (p.payments as Array<{ type: string; amount: number }> | null) || [];
        const bankTransferPayments = payments.filter((pay) => pay.type === "bank_transfer").reduce((s, pay) => s + pay.amount, 0);
        return sum + bankTransferPayments;
      }, 0);

    const expensesTotal = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    const expensesCash = expenses.filter((e) => e.paymentType === "cash").reduce((sum, exp) => sum + Number(exp.amount), 0);
    const expensesBankTransfer = expenses.filter((e) => e.paymentType === "bank_transfer").reduce((sum, exp) => sum + Number(exp.amount), 0);

    // Calculate closing balance
    const closingCash = openingCash + salesCash - purchasesCash - expensesCash;
    
    // Calculate closing card balances (use payments JSON + expense cardId)
    const getCardPayments = (payments: any, cardId: string) => {
      const list = (payments as Array<{ type?: string; amount?: number; cardId?: string }> | null) || [];
      return list
        .filter((p) => p.type === "card" && (!cardId || p.cardId === cardId))
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    };

    const closingCardBalances = openingCardBalances.map((cb) => {
      const card = cardMap.get(cb.cardId);
      if (!card) return { cardId: cb.cardId, cardName: "Unknown", balance: Number(cb.balance) };
      
      const cardSales = sales.reduce((sum, sale) => sum + getCardPayments((sale as any).payments, cb.cardId), 0);
      const cardPurchases = purchases.reduce((sum, p) => sum + getCardPayments(p.payments, cb.cardId), 0);
      const cardExpenses = expenses.reduce(
        (sum, exp) => sum + (exp.cardId === cb.cardId ? Number(exp.amount) : 0),
        0
      );
      
      return {
        cardId: cb.cardId,
        cardName: card.name,
        balance: Number(cb.balance) + cardSales - cardPurchases - cardExpenses,
      };
    });
    
    const closingCardTotal = closingCardBalances.reduce((sum, card) => sum + card.balance, 0);

    // Generate daily reports for each day in range
    const dailyReports: any[] = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr = currentDate.toISOString().split("T")[0];
      try {
        const dailyReport = await this.getDailyReport(dateStr);
        dailyReports.push(dailyReport);
      } catch (error) {
        logger.error(`Error generating daily report for ${dateStr}:`, error);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return {
      startDate,
      endDate,
      summary: {
        openingBalance: {
          cash: openingCash,
          cards: closingCardTotal, // Total of all cards
          total: openingCash + openingCardTotal,
        },
        sales: {
          total: salesTotal,
          cash: salesCash,
          bank_transfer: salesBankTransfer,
          count: sales.length,
        },
        purchases: {
          total: purchasesTotal,
          cash: purchasesCash,
          bank_transfer: purchasesBankTransfer,
          count: purchases.length,
        },
        expenses: {
          total: expensesTotal,
          cash: expensesCash,
          bank_transfer: expensesBankTransfer,
          count: expenses.length,
        },
        closingBalance: {
          cash: closingCash,
          cards: closingCardTotal,
          total: closingCash + closingCardTotal,
        },
      },
      dailyReports,
      sales,
      purchases,
      expenses,
    };
  }
}

export default new ReportService();
