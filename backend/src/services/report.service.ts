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
          openingBankBalances = ((openingBalance as any).bankBalances as any[]) || [];
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

    // Calculate opening balance totals with bank names
    const openingCards = openingCardBalances.map((cb) => {
      const card = cardMap.get(cb.cardId);
      return {
        cardId: cb.cardId,
        cardName: card?.name || "Unknown",
        balance: Number(cb.balance),
      };
    });
    const openingCardTotal = openingCards.reduce((sum, card) => sum + card.balance, 0);
    
    // Map opening bank balances with bank details (names, account numbers)
    const openingBanksWithDetails = openingBankBalances.map((bank) => {
      const bankAccount = bankMap.get(bank.bankAccountId);
      return {
        bankAccountId: bank.bankAccountId,
        bankName: bankAccount?.bankName || "Unknown",
        accountNumber: bankAccount?.accountNumber || "",
        balance: Number(bank.balance || 0),
      };
    });
    const openingBankTotal = openingBanksWithDetails.reduce((sum, bank) => sum + bank.balance, 0);

    // Get sales - fetch a broader range to catch payments that might be on target date
    // Then filter by payment dates in the payments array
    const salesFetchStart = new Date(targetDate);
    salesFetchStart.setDate(salesFetchStart.getDate() - 30); // Look back 30 days for payments
    
    const allSales = await prisma.sale.findMany({
      where: {
        
        date: {
          gte: salesFetchStart,
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

    // Filter sales based on payment dates in payments array
    const sales: any[] = [];
    let salesTotal = 0;
    let salesCash = 0;
    let salesBankTransfer = 0;
    let salesCard = 0;
    
    allSales.forEach((sale) => {
      const payments = (sale.payments as Array<{ 
        type: string; 
        amount: number; 
        date?: string;
        cardId?: string; 
        bankAccountId?: string 
      }> | null) || [];
      
      // Check if any payment falls within target date
      let hasPaymentInDate = false;
      let salePaymentTotal = 0;
      let saleCashAmount = 0;
      let saleBankAmount = 0;
      let saleCardAmount = 0;
      
      if (payments.length > 0) {
        payments.forEach((payment) => {
          // If payment has a date, use it; otherwise use sale.date
          const paymentDate = payment.date ? new Date(payment.date) : new Date(sale.date);
          paymentDate.setHours(0, 0, 0, 0);
          
          // Check if payment is within target date
          if (paymentDate.getTime() >= targetDate.getTime() && paymentDate.getTime() < nextDate.getTime()) {
            hasPaymentInDate = true;
            const amount = Number(payment.amount || 0);
            salePaymentTotal += amount;
            
            if (payment.type === "cash") {
              saleCashAmount += amount;
            } else if (payment.type === "bank_transfer") {
              saleBankAmount += amount;
            } else if (payment.type === "card") {
              saleCardAmount += amount;
            }
          }
        });
      } else {
        // No payments array - use sale.date to check if sale is on target date
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        if (saleDate.getTime() >= targetDate.getTime() && saleDate.getTime() < nextDate.getTime()) {
          hasPaymentInDate = true;
          const amount = Number(sale.total || 0);
          salePaymentTotal = amount;
          
          if (sale.paymentType === "cash") {
            saleCashAmount = amount;
          } else if (sale.paymentType === "bank_transfer") {
            saleBankAmount = amount;
          }
        }
      }
      
      // Only include sale if it has payments in the target date
      if (hasPaymentInDate) {
        sales.push(sale);
        salesTotal += salePaymentTotal;
        salesCash += saleCashAmount;
        salesBankTransfer += saleBankAmount;
        salesCard += saleCardAmount;
      }
    });

    logger.info(`Found ${sales.length} sales with payments on ${date} out of ${allSales.length} total sales`);

    logger.info(`Sales totals for ${date}: Total=${salesTotal}, Cash=${salesCash}, Bank=${salesBankTransfer}, Card=${salesCard}`);

    // Get purchases - fetch a broader range to catch payments that might be on target date
    // Then filter by payment dates in the payments array
    const purchasesFetchStart = new Date(targetDate);
    purchasesFetchStart.setDate(purchasesFetchStart.getDate() - 30); // Look back 30 days for payments
    
    const allPurchases = await prisma.purchase.findMany({
      where: {

        date: {
          gte: purchasesFetchStart,
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
    
    // Filter purchases based on payment dates in payments array
    const purchases: any[] = [];
    let purchasesTotal = 0;
    let purchasesCash = 0;
    let purchasesBankTransfer = 0;
    
    allPurchases.forEach((purchase) => {
      const payments = (purchase.payments as Array<{ 
        type: string; 
        amount: number;
        date?: string;
        cardId?: string;
        bankAccountId?: string;
      }> | null) || [];
      
      // Check if any payment falls within target date
      let hasPaymentInDate = false;
      let purchaseTotal = 0;
      let purchaseCashAmount = 0;
      let purchaseBankAmount = 0;
      
      if (payments.length > 0) {
        payments.forEach((payment) => {
          // If payment has a date, use it; otherwise use purchase.date
          const paymentDate = payment.date ? new Date(payment.date) : new Date(purchase.date);
          paymentDate.setHours(0, 0, 0, 0);
          
          // Check if payment is within target date
          if (paymentDate.getTime() >= targetDate.getTime() && paymentDate.getTime() < nextDate.getTime()) {
            hasPaymentInDate = true;
            const amount = Number(payment.amount || 0);
            purchaseTotal += amount;
            
            if (payment.type === "cash") {
              purchaseCashAmount += amount;
            } else if (payment.type === "bank_transfer") {
              purchaseBankAmount += amount;
            }
          }
        });
      } else {
        // No payments array - use purchase.date to check if purchase is on target date
        const purchaseDate = new Date(purchase.date);
        purchaseDate.setHours(0, 0, 0, 0);
        if (purchaseDate.getTime() >= targetDate.getTime() && purchaseDate.getTime() < nextDate.getTime()) {
          hasPaymentInDate = true;
          purchaseTotal = Number(purchase.total || 0);
          // For purchases without payments array, we can't determine payment type, so skip cash/bank breakdown
        }
      }
      
      // Only include purchase if it has payments in the target date
      if (hasPaymentInDate) {
        purchases.push(purchase);
        purchasesTotal += purchaseTotal;
        purchasesCash += purchaseCashAmount;
        purchasesBankTransfer += purchaseBankAmount;
      }
    });
    
    logger.info(`Found ${purchases.length} purchases with payments on ${date} out of ${allPurchases.length} total purchases`);

    // Transform purchases to payment rows - each payment becomes a separate row
    const purchasesPaymentRows: any[] = [];
    purchases.forEach((purchase) => {
      const payments = (purchase.payments as Array<{ 
        type: string; 
        amount: number;
        date?: string;
        cardId?: string;
        bankAccountId?: string;
      }> | null) || [];
      
      if (payments.length > 0) {
        // Create a row for each payment
        payments.forEach((payment, paymentIndex) => {
          const paymentDate = payment.date ? new Date(payment.date) : new Date(purchase.date);
          paymentDate.setHours(0, 0, 0, 0);
          
          // Only include payments within target date
          if (paymentDate.getTime() >= targetDate.getTime() && paymentDate.getTime() < nextDate.getTime()) {
            purchasesPaymentRows.push({
              ...purchase,
              // Override with payment-specific data
              date: payment.date || purchase.date,
              paymentAmount: Number(payment.amount || 0),
              paymentType: payment.type,
              paymentIndex: paymentIndex,
              paymentDate: payment.date || purchase.date,
              // Keep original total for reference
              originalTotal: Number(purchase.total || 0),
            });
          }
        });
      } else {
        // No payments array - use purchase as single row
        const purchaseDate = new Date(purchase.date);
        purchaseDate.setHours(0, 0, 0, 0);
        if (purchaseDate.getTime() >= targetDate.getTime() && purchaseDate.getTime() < nextDate.getTime()) {
          purchasesPaymentRows.push({
            ...purchase,
            paymentAmount: Number(purchase.total || 0),
            paymentType: "cash", // Default if no payment type
            paymentIndex: 0,
            paymentDate: purchase.date,
            originalTotal: Number(purchase.total || 0),
          });
        }
      }
    });

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
    const getCardPayments = (payments: any, cardId: string, saleDate?: Date, purchaseDate?: Date) => {
      const list = (payments as Array<{ type?: string; amount?: number; cardId?: string; date?: string }> | null) || [];
      const dateToCheck = saleDate || purchaseDate || targetDate;
      const dateEnd = nextDate;
      
      return list
        .filter((p) => {
          // Check if payment type matches and cardId matches if provided
          if (p.type !== "card" || (cardId && p.cardId !== cardId)) {
            return false;
          }
          
          // Check if payment date falls within target date range
          if (p.date) {
            const paymentDate = new Date(p.date);
            paymentDate.setHours(0, 0, 0, 0);
            return paymentDate.getTime() >= dateToCheck.getTime() && paymentDate.getTime() < dateEnd.getTime();
          }
          
          // If no payment date, use sale/purchase date
          const itemDate = new Date(dateToCheck);
          itemDate.setHours(0, 0, 0, 0);
          return itemDate.getTime() >= targetDate.getTime() && itemDate.getTime() < nextDate.getTime();
        })
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    };

    const closingCardBalances = openingCardBalances.map((cb) => {
      const card = cardMap.get(cb.cardId);
      if (!card) return { cardId: cb.cardId, cardName: "Unknown", balance: Number(cb.balance) };
      
      // Add card sales from payments JSON, subtract card purchases (payments JSON) and card expenses (by cardId)
      const cardSales = sales.reduce((sum, sale) => sum + getCardPayments((sale as any).payments, cb.cardId, new Date(sale.date)), 0);
      const cardPurchases = purchases.reduce((sum, p) => sum + getCardPayments(p.payments, cb.cardId, undefined, new Date(p.date)), 0);
      const cardExpenses = expenses.reduce(
        (sum, exp) => {
          const expDate = new Date(exp.date);
          expDate.setHours(0, 0, 0, 0);
          if (exp.cardId === cb.cardId && expDate.getTime() >= targetDate.getTime() && expDate.getTime() < nextDate.getTime()) {
            return sum + Number(exp.amount);
          }
          return sum;
        },
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
        .filter((t: any) => t.source === "add_opening_balance" || t.source === "opening_balance")
        .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
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

    // Transform sales to payment rows - each payment becomes a separate row
    const salesPaymentRows: any[] = [];
    sales.forEach((sale) => {
      const payments = (sale.payments as Array<{ 
        type: string; 
        amount: number;
        date?: string;
        cardId?: string;
        bankAccountId?: string;
      }> | null) || [];
      
      if (payments.length > 0) {
        // Create a row for each payment
        payments.forEach((payment, paymentIndex) => {
          const paymentDate = payment.date ? new Date(payment.date) : new Date(sale.date);
          paymentDate.setHours(0, 0, 0, 0);
          
          // Only include payments within target date
          if (paymentDate.getTime() >= targetDate.getTime() && paymentDate.getTime() < nextDate.getTime()) {
            salesPaymentRows.push({
              ...sale,
              // Override with payment-specific data
              date: payment.date || sale.date,
              paymentAmount: Number(payment.amount || 0),
              paymentType: payment.type,
              paymentIndex: paymentIndex,
              paymentDate: payment.date || sale.date,
              // Keep original total for reference
              originalTotal: Number(sale.total || 0),
            });
          }
        });
      } else {
        // No payments array - use sale as single row
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        if (saleDate.getTime() >= targetDate.getTime() && saleDate.getTime() < nextDate.getTime()) {
          salesPaymentRows.push({
            ...sale,
            paymentAmount: Number(sale.total || 0),
            paymentType: sale.paymentType || "cash",
            paymentIndex: 0,
            paymentDate: sale.date,
            originalTotal: Number(sale.total || 0),
          });
        }
      }
    });

    // Comprehensive logging for debugging
    logger.info(`=== Daily Report Summary for ${date} ===`);
    logger.info(`Opening Balance: Cash=${openingCash}, Banks=${openingBankTotal}, Cards=${openingCardTotal}, Total=${openingCash + openingBankTotal + openingCardTotal}`);
    logger.info(`Sales: Total=${salesTotal}, Cash=${salesCash}, Bank=${salesBankTransfer}, Card=${salesCard}, Payment Rows=${salesPaymentRows.length}, Sales=${sales.length}`);
    logger.info(`Purchases: Total=${purchasesTotal}, Cash=${purchasesCash}, Bank=${purchasesBankTransfer}, Payment Rows=${purchasesPaymentRows.length}, Purchases=${purchases.length}`);
    logger.info(`Expenses: Total=${expensesTotal}, Cash=${expensesCash}, Bank=${expensesBankTransfer}, Count=${expenses.length}`);
    logger.info(`Closing Balance: Cash=${closingCash}, Banks=${closingBankTotal}, Cards=${closingCardTotal}, Total=${closingCash + closingBankTotal + closingCardTotal}`);
    logger.info(`Opening Balance Additions: ${openingBalanceAdditions.length}`);

    return {
      date: date,
      openingBalance: {
        cash: openingCash,
        banks: openingBanksWithDetails,
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
        beforeBalance: t.beforeBalance !== null && t.beforeBalance !== undefined ? Number(t.beforeBalance) : null,
        afterBalance: t.afterBalance !== null && t.afterBalance !== undefined ? Number(t.afterBalance) : null,
        changeAmount: t.changeAmount !== null && t.changeAmount !== undefined ? Number(t.changeAmount) : null,
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
        count: salesPaymentRows.length, // Count of payment rows, not sales
        items: salesPaymentRows, // Payment rows instead of sales
      },
      purchases: {
        total: purchasesTotal,
        cash: purchasesCash,
        bank_transfer: purchasesBankTransfer,
        count: purchasesPaymentRows.length, // Count of payment rows, not purchases
        items: purchasesPaymentRows, // Payment rows instead of purchases
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
   * Generate comprehensive daily report PDF with chronological order and before/after balances
   */
  async generateDailyReportPDF(date: string, res: Response) {
    const report = await this.getDailyReport(date);
    const settings = await prisma.shopSettings.findFirst();

    // Get all balance transactions for this date to show before/after balances
    const balanceTransactionService = (await import("./balanceTransaction.service")).default;
    let allBalanceTransactions: any[] = [];
    try {
      allBalanceTransactions = await balanceTransactionService.getTransactions({
        startDate: date,
        endDate: date,
      });
      // Sort by creation time
      allBalanceTransactions.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } catch (e) {
      logger.error("Error fetching balance transactions for PDF:", e);
    }

    // Create a map of balance transactions by source, sourceId, and paymentType
    const balanceTxMap = new Map<string, any[]>();
    allBalanceTransactions.forEach((tx: any) => {
      // Match by source and sourceId, then by paymentType
      const key = `${tx.source || ''}_${tx.sourceId || ''}_${tx.paymentType || 'cash'}`;
      if (!balanceTxMap.has(key)) {
        balanceTxMap.set(key, []);
      }
      balanceTxMap.get(key)!.push(tx);
    });

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

    // Opening Balance Section - Matching opening balance page design
    doc.fontSize(16).text("Previous Day Closing Balance (Opening Balance)", { underline: true });
    doc.moveDown();
    
    // Cash Balance Card
    doc.rect(50, doc.y, 200, 40).fillColor('#dbeafe').fill();
    doc.fillColor('black');
    doc.fontSize(10).text("Cash Balance", 55, doc.y + 5);
    doc.fontSize(18).font("Helvetica-Bold").fillColor('#2563eb');
    doc.text(`Rs. ${report.openingBalance.cash.toFixed(2)}`, 55, doc.y + 15);
    doc.fillColor('black');
    doc.moveDown(0.8);
    
    // Bank Balances
    if (report.openingBalance.banks && report.openingBalance.banks.length > 0) {
      doc.fontSize(11).font("Helvetica-Bold").text("Bank-wise Balances", { underline: false });
      doc.moveDown(0.3);
      report.openingBalance.banks.forEach((bank: any) => {
        const bankName = bank.bankName || "Bank";
        const accountNumber = bank.accountNumber || "";
        doc.rect(50, doc.y, 200, 30).fillColor('#ffffff').strokeColor('#d1d5db').lineWidth(1).fillAndStroke();
        doc.fillColor('black');
        doc.fontSize(8).text(bankName, 55, doc.y + 3);
        if (accountNumber) {
          doc.fontSize(7).fillColor('#6b7280').text(accountNumber, 55, doc.y + 12);
          doc.fillColor('black');
        }
        doc.fontSize(11).font("Helvetica-Bold").text(`Rs. ${Number(bank.balance || 0).toFixed(2)}`, 55, doc.y + 18);
        doc.moveDown(0.5);
      });
      
      // Total Bank Balance
      const openingBankTotal = report.openingBalance.banks.reduce((sum: number, bank: any) => sum + Number(bank.balance || 0), 0);
      doc.moveUp(0.2);
      doc.rect(50, doc.y, 200, 25).fillColor('#f9fafb').fill();
      doc.fillColor('black');
      doc.fontSize(9).font("Helvetica-Bold").text("Total Bank Balance:", 55, doc.y + 5);
      doc.fontSize(12).text(`Rs. ${openingBankTotal.toFixed(2)}`, 55, doc.y + 15);
      doc.moveDown(0.5);
    }
    
    // Grand Total
    doc.rect(50, doc.y, 200, 35).fillColor('#f9fafb').fill().strokeColor('#9ca3af').lineWidth(2).stroke();
    doc.fillColor('black');
    doc.fontSize(11).font("Helvetica-Bold").text("Grand Total:", 55, doc.y + 5);
    doc.fontSize(20).fillColor('#9333ea');
    doc.text(`Rs. ${report.openingBalance.total.toFixed(2)}`, 55, doc.y + 15);
    doc.fillColor('black');
    doc.moveDown(1.5);

    // Build chronological transaction list with before/after balances
    const allTransactions: any[] = [];

    // Add opening balance additions
    if (report.openingBalanceAdditions && report.openingBalanceAdditions.length > 0) {
      report.openingBalanceAdditions.forEach((add: any) => {
        allTransactions.push({
          type: 'Additional Balance',
          datetime: new Date(add.time || add.date || date),
          paymentType: add.paymentType,
          amount: Number(add.amount || 0),
          beforeBalance: add.beforeBalance,
          afterBalance: add.afterBalance,
          description: add.description || 'Opening Balance Addition',
          bankName: add.bankAccount?.bankName || '',
          userName: add.userName,
        });
      });
    }

    // Add purchases with balance transaction data
    // Note: report.purchases.items contains payment rows (purchasesPaymentRows)
    if (report.purchases && report.purchases.items && report.purchases.items.length > 0) {
      report.purchases.items.forEach((purchaseRow: any) => {
        // purchaseRow is already a payment row with paymentAmount, paymentDate, paymentType
        const paymentDate = purchaseRow.paymentDate ? new Date(purchaseRow.paymentDate) : (purchaseRow.date ? new Date(purchaseRow.date) : new Date(purchaseRow.createdAt));
        const key = `purchase_payment_${purchaseRow.id}_${purchaseRow.paymentType || 'cash'}`;
        let balanceTxs = balanceTxMap.get(key) || [];
        if (balanceTxs.length === 0) {
          const key2 = `purchase_${purchaseRow.id}_${purchaseRow.paymentType || 'cash'}`;
          balanceTxs = balanceTxMap.get(key2) || [];
        }
        const balanceTx = balanceTxs.length > 0 ? balanceTxs[0] : null;
        
        allTransactions.push({
          type: 'Purchase',
          datetime: paymentDate,
          paymentType: purchaseRow.paymentType || 'cash',
          amount: Number(purchaseRow.paymentAmount || purchaseRow.total || 0),
          beforeBalance: balanceTx?.beforeBalance !== null && balanceTx?.beforeBalance !== undefined ? Number(balanceTx.beforeBalance) : null,
          afterBalance: balanceTx?.afterBalance !== null && balanceTx?.afterBalance !== undefined ? Number(balanceTx.afterBalance) : null,
          description: `Purchase - ${purchaseRow.supplierName || 'N/A'}`,
          bankName: purchaseRow.bankAccountId ? (purchaseRow.bankAccount?.bankName || 'Bank Transfer') : '',
        });
      });
    }

    // Add sales with balance transaction data
    // Note: report.sales.items contains payment rows (salesPaymentRows)
    if (report.sales && report.sales.items && report.sales.items.length > 0) {
      report.sales.items.forEach((saleRow: any) => {
        // saleRow is already a payment row with paymentAmount, paymentDate, paymentType
        const paymentDate = saleRow.paymentDate ? new Date(saleRow.paymentDate) : (saleRow.date ? new Date(saleRow.date) : new Date(saleRow.createdAt));
        const key = `sale_payment_${saleRow.id}_${saleRow.paymentType || 'cash'}`;
        let balanceTxs = balanceTxMap.get(key) || [];
        if (balanceTxs.length === 0) {
          const key2 = `sale_${saleRow.id}_${saleRow.paymentType || 'cash'}`;
          balanceTxs = balanceTxMap.get(key2) || [];
        }
        const balanceTx = balanceTxs.length > 0 ? balanceTxs[0] : null;
        
        allTransactions.push({
          type: 'Sale',
          datetime: paymentDate,
          paymentType: saleRow.paymentType || 'cash',
          amount: Number(saleRow.paymentAmount || saleRow.total || 0),
          beforeBalance: balanceTx?.beforeBalance !== null && balanceTx?.beforeBalance !== undefined ? Number(balanceTx.beforeBalance) : null,
          afterBalance: balanceTx?.afterBalance !== null && balanceTx?.afterBalance !== undefined ? Number(balanceTx.afterBalance) : null,
          description: `Sale - Bill #${saleRow.billNumber || 'N/A'} - ${saleRow.customerName || 'Walk-in'}`,
          bankName: saleRow.bankAccountId ? (saleRow.bankAccount?.bankName || 'Bank Transfer') : '',
        });
      });
    }

    // Add expenses with balance transaction data
    if (report.expenses.items && report.expenses.items.length > 0) {
      report.expenses.items.forEach((expense: any) => {
        const expenseDate = new Date(expense.createdAt);
        const key = `expense_${expense.id}_${expense.paymentType || 'cash'}`;
        const balanceTxs = balanceTxMap.get(key) || [];
        const balanceTx = balanceTxs.length > 0 ? balanceTxs[0] : null;
        
        allTransactions.push({
          type: 'Expense',
          datetime: expenseDate,
          paymentType: expense.paymentType || 'cash',
          amount: Number(expense.amount || 0),
          beforeBalance: balanceTx?.beforeBalance !== null && balanceTx?.beforeBalance !== undefined ? Number(balanceTx.beforeBalance) : null,
          afterBalance: balanceTx?.afterBalance !== null && balanceTx?.afterBalance !== undefined ? Number(balanceTx.afterBalance) : null,
          description: expense.description || expense.category || 'Expense',
          bankName: expense.bankAccountId ? 'Bank Transfer' : '',
        });
      });
    }

    // Sort all transactions by datetime
    allTransactions.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

    // Create chronological table matching opening balance design
    if (allTransactions.length > 0) {
      doc.fontSize(14).text("Chronological Transaction Details", { underline: true });
      doc.moveDown();
      
      // Table header with better styling
      const tableTop = doc.y;
      const rowHeight = 18;
      const colWidths = [60, 50, 80, 100, 50, 60, 70, 70, 70];
      let currentY = tableTop;
      
      // Draw header background
      doc.rect(50, currentY - 5, 500, rowHeight).fillColor('#f3f4f6').fill();
      doc.fillColor('black');
      
      // Header row
      doc.fontSize(9);
      doc.font("Helvetica-Bold");
      doc.text("Time", 55, currentY);
      doc.text("Type", 55 + colWidths[0], currentY);
      doc.text("Source", 55 + colWidths[0] + colWidths[1], currentY, { width: colWidths[2] });
      doc.text("Description", 55 + colWidths[0] + colWidths[1] + colWidths[2], currentY, { width: colWidths[3] });
      doc.text("Pay Type", 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], currentY, { width: colWidths[4] });
      doc.text("Bank", 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], currentY, { width: colWidths[5] });
      doc.text("Before", 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5], currentY, { width: colWidths[6], align: "right" });
      doc.text("Change", 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6], currentY, { width: colWidths[7], align: "right" });
      doc.text("After", 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6] + colWidths[7], currentY, { width: colWidths[8], align: "right" });
      
      currentY += rowHeight;
      doc.font("Helvetica");
      doc.fontSize(8);
      
      // Helper function to get source label
      const getSourceLabel = (type: string) => {
        const labels: Record<string, string> = {
          'Sale': 'Sale Payment',
          'Purchase': 'Purchase Payment',
          'Expense': 'Expense Payment',
          'Additional Balance': 'Add to Opening Balance',
        };
        return labels[type] || type;
      };
      
      // Transaction rows
      allTransactions.forEach((tran, index) => {
        if (currentY > 750) {
          doc.addPage();
          currentY = 50;
          // Redraw header on new page
          doc.rect(50, currentY - 5, 500, rowHeight).fillColor('#f3f4f6').fill();
          doc.fillColor('black');
          doc.fontSize(9);
          doc.font("Helvetica-Bold");
          doc.text("Time", 55, currentY);
          doc.text("Type", 55 + colWidths[0], currentY);
          doc.text("Source", 55 + colWidths[0] + colWidths[1], currentY, { width: colWidths[2] });
          doc.text("Description", 55 + colWidths[0] + colWidths[1] + colWidths[2], currentY, { width: colWidths[3] });
          doc.text("Pay Type", 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], currentY, { width: colWidths[4] });
          doc.text("Bank", 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], currentY, { width: colWidths[5] });
          doc.text("Before", 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5], currentY, { width: colWidths[6], align: "right" });
          doc.text("Change", 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6], currentY, { width: colWidths[7], align: "right" });
          doc.text("After", 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6] + colWidths[7], currentY, { width: colWidths[8], align: "right" });
          currentY += rowHeight;
          doc.font("Helvetica");
          doc.fontSize(8);
        }
        
        const isIncome = tran.type === 'Sale' || tran.type === 'Additional Balance';
        
        // Row background color
        if (index % 2 === 0) {
          doc.rect(50, currentY - 3, 500, rowHeight).fillColor(isIncome ? '#f0fdf4' : '#fef2f2').fill();
          doc.fillColor('black');
        }
        
        const timeStr = tran.datetime.toLocaleString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
        
        doc.text(timeStr, 55, currentY, { width: colWidths[0] });
        
        // Type badge
        const typeStr = isIncome ? 'Income' : 'Expense';
        doc.fillColor(isIncome ? '#166534' : '#991b1b');
        doc.fontSize(7);
        doc.text(typeStr, 55 + colWidths[0], currentY, { width: colWidths[1] });
        doc.fillColor('black');
        doc.fontSize(8);
        
        doc.text(getSourceLabel(tran.type), 55 + colWidths[0] + colWidths[1], currentY, { width: colWidths[2] });
        doc.text(tran.description.substring(0, 25), 55 + colWidths[0] + colWidths[1] + colWidths[2], currentY, { width: colWidths[3] });
        
        const paymentTypeStr = tran.paymentType === 'cash' ? 'Cash' : 'Bank';
        doc.text(paymentTypeStr, 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], currentY, { width: colWidths[4] });
        doc.text(tran.bankName || '-', 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], currentY, { width: colWidths[5] });
        
        const beforeStr = tran.beforeBalance !== null ? 'Rs. ' + tran.beforeBalance.toFixed(2) : '-';
        doc.text(beforeStr, 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5], currentY, { width: colWidths[6], align: "right" });
        
        const amountStr = (isIncome ? '+' : '-') + 'Rs. ' + tran.amount.toFixed(2);
        doc.fillColor(isIncome ? '#16a34a' : '#dc2626');
        doc.font("Helvetica-Bold");
        doc.text(amountStr, 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6], currentY, { width: colWidths[7], align: "right" });
        doc.fillColor('black');
        doc.font("Helvetica");
        
        const afterStr = tran.afterBalance !== null ? 'Rs. ' + tran.afterBalance.toFixed(2) : '-';
        doc.text(afterStr, 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6] + colWidths[7], currentY, { width: colWidths[8], align: "right" });
        
        currentY += rowHeight;
      });
      
      doc.moveDown(2);
    } else {
      doc.fontSize(12).text("No transactions found for this date.", { align: "center" });
      doc.moveDown(2);
    }

    // Summary - Matching opening balance page design
    doc.fontSize(16).text("Summary", { underline: true });
    doc.moveDown();
    
    const additionalTotal = report.openingBalanceAdditions?.reduce((sum: number, add: any) => sum + Number(add.amount || 0), 0) || 0;
    
    // Summary cards in 2x2 grid
    const cardWidth = 200;
    const cardHeight = 50;
    let cardX = 50;
    let cardY = doc.y;
    
    // Total Sales
    doc.rect(cardX, cardY, cardWidth, cardHeight).fillColor('#ffffff').strokeColor('#d1d5db').lineWidth(1).fillAndStroke();
    doc.fontSize(9).fillColor('#6b7280').text("Total Sales", cardX + 10, cardY + 5);
    doc.fontSize(16).font("Helvetica-Bold").fillColor('#16a34a');
    doc.text(`Rs. ${report.sales.total.toFixed(2)}`, cardX + 10, cardY + 20);
    doc.fillColor('black');
    
    // Total Purchases
    cardX += cardWidth + 20;
    doc.rect(cardX, cardY, cardWidth, cardHeight).fillColor('#ffffff').strokeColor('#d1d5db').lineWidth(1).fillAndStroke();
    doc.fontSize(9).fillColor('#6b7280').text("Total Purchases", cardX + 10, cardY + 5);
    doc.fontSize(16).font("Helvetica-Bold").fillColor('#ea580c');
    doc.text(`Rs. ${report.purchases.total.toFixed(2)}`, cardX + 10, cardY + 20);
    doc.fillColor('black');
    
    // Total Expenses
    cardX = 50;
    cardY += cardHeight + 15;
    doc.rect(cardX, cardY, cardWidth, cardHeight).fillColor('#ffffff').strokeColor('#d1d5db').lineWidth(1).fillAndStroke();
    doc.fontSize(9).fillColor('#6b7280').text("Total Expenses", cardX + 10, cardY + 5);
    doc.fontSize(16).font("Helvetica-Bold").fillColor('#dc2626');
    doc.text(`Rs. ${report.expenses.total.toFixed(2)}`, cardX + 10, cardY + 20);
    doc.fillColor('black');
    
    // Total Additional Balance
    cardX += cardWidth + 20;
    doc.rect(cardX, cardY, cardWidth, cardHeight).fillColor('#ffffff').strokeColor('#d1d5db').lineWidth(1).fillAndStroke();
    doc.fontSize(9).fillColor('#6b7280').text("Total Additional Balance", cardX + 10, cardY + 5);
    doc.fontSize(16).font("Helvetica-Bold").fillColor('#9333ea');
    doc.text(`Rs. ${additionalTotal.toFixed(2)}`, cardX + 10, cardY + 20);
    doc.fillColor('black');
    
    // Closing Cash Balance
    cardY += cardHeight + 20;
    doc.rect(50, cardY, 420, 45).fillColor('#dbeafe').fill();
    doc.fontSize(10).fillColor('#4b5563').text("Closing Cash Balance", 55, cardY + 5);
    doc.fontSize(20).font("Helvetica-Bold").fillColor('#2563eb');
    doc.text(`Rs. ${report.closingBalance.cash.toFixed(2)}`, 55, cardY + 20);
    doc.fillColor('black');
    cardY += 55;
    
    // Closing Bank Balances
    if (report.closingBalance.banks && report.closingBalance.banks.length > 0) {
      doc.fontSize(11).font("Helvetica-Bold").text("Closing Bank Balances", 50, cardY);
      cardY += 15;
      report.closingBalance.banks.forEach((bank: any) => {
        const bankName = bank.bankName || "Bank";
        const accountNumber = bank.accountNumber || "";
        doc.rect(50, cardY, 200, 30).fillColor('#ffffff').strokeColor('#d1d5db').lineWidth(1).fillAndStroke();
        doc.fillColor('black');
        doc.fontSize(8).text(bankName, 55, cardY + 3);
        if (accountNumber) {
          doc.fontSize(7).fillColor('#6b7280').text(accountNumber, 55, cardY + 12);
          doc.fillColor('black');
        }
        doc.fontSize(11).font("Helvetica-Bold").text(`Rs. ${Number(bank.balance || 0).toFixed(2)}`, 55, cardY + 18);
        cardY += 35;
      });
      
      // Total Closing Bank Balance
      const closingBankTotal = report.closingBalance.banks.reduce((sum: number, bank: any) => sum + Number(bank.balance || 0), 0);
      doc.rect(50, cardY, 200, 25).fillColor('#f9fafb').fill();
      doc.fillColor('black');
      doc.fontSize(9).font("Helvetica-Bold").text("Total Closing Bank Balance:", 55, cardY + 5);
      doc.fontSize(12).text(`Rs. ${closingBankTotal.toFixed(2)}`, 55, cardY + 15);
      cardY += 30;
    }
    
    // Grand Total Closing Balance
    doc.rect(50, cardY, 420, 40).fillColor('#f9fafb').fill().strokeColor('#9ca3af').lineWidth(2).stroke();
    doc.fillColor('black');
    doc.fontSize(11).font("Helvetica-Bold").text("Closing Balance (Grand Total):", 55, cardY + 5);
    doc.fontSize(22).fillColor('#9333ea');
    doc.text(`Rs. ${report.closingBalance.total.toFixed(2)}`, 55, cardY + 20);
    doc.fillColor('black');

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

    // Get all banks for mapping
    const banks = await prisma.bankAccount.findMany();
    const bankMap = new Map(banks.map((bank) => [bank.id, bank]));

    // Calculate opening balance totals with bank details
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
    
    // Map opening bank balances with bank details (names, account numbers)
    const openingBankBalances = ((openingBalance as any)?.bankBalances as Array<{ bankAccountId: string; balance: number }> | null) || [];
    const openingBanksWithDetails = openingBankBalances.map((bank) => {
      const bankAccount = bankMap.get(bank.bankAccountId);
      return {
        bankAccountId: bank.bankAccountId,
        bankName: bankAccount?.bankName || "Unknown",
        accountNumber: bankAccount?.accountNumber || "",
        balance: Number(bank.balance || 0),
      };
    });
    const openingBankTotal = openingBanksWithDetails.reduce((sum, bank) => sum + bank.balance, 0);

    // Get all sales - fetch a broader range to catch payments that might be in date range
    // Then filter by payment dates in the payments array
    const salesFetchStart = new Date(start);
    salesFetchStart.setDate(salesFetchStart.getDate() - 30); // Look back 30 days for payments
    
    const allSales = await prisma.sale.findMany({
      where: {
        status: "completed",
        date: {
          gte: salesFetchStart,
          lte: end,
        },
      },
      include: {
        items: true,
        customer: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Filter sales based on payment dates in payments array
    const sales: any[] = [];
    
    allSales.forEach((sale) => {
      const payments = (sale.payments as Array<{ 
        type: string; 
        amount: number;
        date?: string;
        cardId?: string;
        bankAccountId?: string;
      }> | null) || [];
      
      // Check if any payment falls within date range
      let hasPaymentInRange = false;
      
      if (payments.length > 0) {
        payments.forEach((payment) => {
          // If payment has a date, use it; otherwise use sale.date
          const paymentDate = payment.date ? new Date(payment.date) : new Date(sale.date);
          paymentDate.setHours(0, 0, 0, 0);
          
          // Check if payment is within date range
          if (paymentDate.getTime() >= start.getTime() && paymentDate.getTime() <= end.getTime()) {
            hasPaymentInRange = true;
          }
        });
      } else {
        // No payments array - use sale.date to check if sale is in date range
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        if (saleDate.getTime() >= start.getTime() && saleDate.getTime() <= end.getTime()) {
          hasPaymentInRange = true;
        }
      }
      
      // Only include sale if it has payments in the date range
      if (hasPaymentInRange) {
        sales.push(sale);
      }
    });

    // Get all purchases - fetch a broader range to catch payments that might be in date range
    // Then filter by payment dates in the payments array
    const purchasesFetchStart = new Date(start);
    purchasesFetchStart.setDate(purchasesFetchStart.getDate() - 30); // Look back 30 days for payments
    
    const allPurchases = await prisma.purchase.findMany({
      where: {
        status: "completed",
        date: {
          gte: purchasesFetchStart,
          lte: end,
        },
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Filter purchases based on payment dates in payments array
    const purchases: any[] = [];
    
    allPurchases.forEach((purchase) => {
      const payments = (purchase.payments as Array<{ 
        type: string; 
        amount: number;
        date?: string;
        cardId?: string;
        bankAccountId?: string;
      }> | null) || [];
      
      // Check if any payment falls within date range
      let hasPaymentInRange = false;
      
      if (payments.length > 0) {
        payments.forEach((payment) => {
          // If payment has a date, use it; otherwise use purchase.date
          const paymentDate = payment.date ? new Date(payment.date) : new Date(purchase.date);
          paymentDate.setHours(0, 0, 0, 0);
          
          // Check if payment is within date range
          if (paymentDate.getTime() >= start.getTime() && paymentDate.getTime() <= end.getTime()) {
            hasPaymentInRange = true;
          }
        });
      } else {
        // No payments array - use purchase.date to check if purchase is in date range
        const purchaseDate = new Date(purchase.date);
        purchaseDate.setHours(0, 0, 0, 0);
        if (purchaseDate.getTime() >= start.getTime() && purchaseDate.getTime() <= end.getTime()) {
          hasPaymentInRange = true;
        }
      }
      
      // Only include purchase if it has payments in the date range
      if (hasPaymentInRange) {
        purchases.push(purchase);
      }
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

    // Calculate summary totals - only count payments that fall within date range
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
        bankAccountId?: string;
      }> | null) || [];
      
      if (payments.length > 0) {
        // Only count payments that fall within date range
        payments.forEach((payment) => {
          const paymentDate = payment.date ? new Date(payment.date) : new Date(sale.date);
          paymentDate.setHours(0, 0, 0, 0);
          
          // Only count if payment is within date range
          if (paymentDate.getTime() >= start.getTime() && paymentDate.getTime() <= end.getTime()) {
            const amount = Number(payment.amount || 0);
            salesTotal += amount;
            
            if (payment.type === "cash") {
              salesCash += amount;
            } else if (payment.type === "bank_transfer") {
              salesBankTransfer += amount;
            } else if (payment.type === "card") {
              salesCard += amount;
            }
          }
        });
      } else {
        // No payments array - use sale.date to check if sale is in date range
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        if (saleDate.getTime() >= start.getTime() && saleDate.getTime() <= end.getTime()) {
          const amount = Number(sale.total || 0);
          salesTotal += amount;
          
          if (sale.paymentType === "cash") {
            salesCash += amount;
          } else if (sale.paymentType === "bank_transfer") {
            salesBankTransfer += amount;
          }
        }
      }
    });

    let purchasesTotal = 0;
    let purchasesCash = 0;
    let purchasesBankTransfer = 0;
    
    purchases.forEach((purchase) => {
      const payments = (purchase.payments as Array<{ 
        type: string; 
        amount: number;
        date?: string;
        cardId?: string;
        bankAccountId?: string;
      }> | null) || [];
      
      if (payments.length > 0) {
        // Only count payments that fall within date range
        payments.forEach((payment) => {
          const paymentDate = payment.date ? new Date(payment.date) : new Date(purchase.date);
          paymentDate.setHours(0, 0, 0, 0);
          
          // Only count if payment is within date range
          if (paymentDate.getTime() >= start.getTime() && paymentDate.getTime() <= end.getTime()) {
            const amount = Number(payment.amount || 0);
            purchasesTotal += amount;
            
            if (payment.type === "cash") {
              purchasesCash += amount;
            } else if (payment.type === "bank_transfer") {
              purchasesBankTransfer += amount;
            }
          }
        });
      } else {
        // No payments array - use purchase.date to check if purchase is in date range
        const purchaseDate = new Date(purchase.date);
        purchaseDate.setHours(0, 0, 0, 0);
        if (purchaseDate.getTime() >= start.getTime() && purchaseDate.getTime() <= end.getTime()) {
          purchasesTotal += Number(purchase.total || 0);
          // For purchases without payments array, we can't determine payment type breakdown
        }
      }
    });

    const expensesTotal = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    const expensesCash = expenses.filter((e) => e.paymentType === "cash").reduce((sum, exp) => sum + Number(exp.amount), 0);
    const expensesBankTransfer = expenses.filter((e) => e.paymentType === "bank_transfer").reduce((sum, exp) => sum + Number(exp.amount), 0);

    // Calculate closing balance
    const closingCash = openingCash + salesCash - purchasesCash - expensesCash;
    
    // Calculate closing card balances (use payments JSON + expense cardId)
    const getCardPayments = (payments: any, cardId: string, saleDate?: Date, purchaseDate?: Date) => {
      const list = (payments as Array<{ type?: string; amount?: number; cardId?: string; date?: string }> | null) || [];
      const dateToCheck = saleDate || purchaseDate;
      
      return list
        .filter((p) => {
          // Check if payment type matches and cardId matches if provided
          if (p.type !== "card" || (cardId && p.cardId !== cardId)) {
            return false;
          }
          
          // Check if payment date falls within date range
          if (p.date) {
            const paymentDate = new Date(p.date);
            paymentDate.setHours(0, 0, 0, 0);
            return paymentDate.getTime() >= start.getTime() && paymentDate.getTime() <= end.getTime();
          }
          
          // If no payment date, use sale/purchase date
          if (dateToCheck) {
            const itemDate = new Date(dateToCheck);
            itemDate.setHours(0, 0, 0, 0);
            return itemDate.getTime() >= start.getTime() && itemDate.getTime() <= end.getTime();
          }
          
          return true; // If no date available, include it (fallback)
        })
        .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    };

    const closingCardBalances = openingCardBalances.map((cb) => {
      const card = cardMap.get(cb.cardId);
      if (!card) return { cardId: cb.cardId, cardName: "Unknown", balance: Number(cb.balance) };
      
      const cardSales = sales.reduce((sum, sale) => sum + getCardPayments((sale as any).payments, cb.cardId, new Date(sale.date)), 0);
      const cardPurchases = purchases.reduce((sum, p) => sum + getCardPayments(p.payments, cb.cardId, undefined, new Date(p.date)), 0);
      const cardExpenses = expenses.reduce(
        (sum, exp) => {
          const expDate = new Date(exp.date);
          expDate.setHours(0, 0, 0, 0);
          if (exp.cardId === cb.cardId && expDate.getTime() >= start.getTime() && expDate.getTime() <= end.getTime()) {
            return sum + Number(exp.amount);
          }
          return sum;
        },
        0
      );
      
      return {
        cardId: cb.cardId,
        cardName: card.name,
        balance: Number(cb.balance) + cardSales - cardPurchases - cardExpenses,
      };
    });
    
    const closingCardTotal = closingCardBalances.reduce((sum, card) => sum + card.balance, 0);

    // Get opening balance additions for the date range (transactions where source is "add_opening_balance")
    const balanceTransactionService = (await import("./balanceTransaction.service")).default;
    let openingBalanceAdditions: any[] = [];
    try {
      const transactions = await balanceTransactionService.getTransactions({
        startDate: startDate,
        endDate: endDate,
      });
      openingBalanceAdditions = transactions
        .filter((t: any) => t.source === "add_opening_balance" || t.source === "opening_balance")
        .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } catch (e) {
      logger.error("Error fetching opening balance additions for date range:", e);
    }

    // Calculate closing bank balances for date range report
    const closingBankBalances = openingBanksWithDetails.map((bank) => {
      const bankSales = sales.reduce((sum, sale) => {
        const payments = (sale.payments as Array<{ type: string; amount: number; bankAccountId?: string; date?: string }> | null) || [];
        return sum + payments
          .filter((p) => {
            // Check if payment is within date range
            if (p.date) {
              const paymentDate = new Date(p.date);
              paymentDate.setHours(0, 0, 0, 0);
              return paymentDate.getTime() >= start.getTime() && paymentDate.getTime() <= end.getTime();
            }
            // If no payment date, use sale date
            const saleDate = new Date(sale.date);
            saleDate.setHours(0, 0, 0, 0);
            return saleDate.getTime() >= start.getTime() && saleDate.getTime() <= end.getTime();
          })
          .filter((p) => p.type === "bank_transfer" && p.bankAccountId === bank.bankAccountId)
          .reduce((s, p) => s + Number(p.amount || 0), 0);
      }, 0);
      
      const bankPurchases = purchases.reduce((sum, p) => {
        const payments = (p.payments as Array<{ type: string; amount: number; bankAccountId?: string; date?: string }> | null) || [];
        return sum + payments
          .filter((pay) => {
            // Check if payment is within date range
            if (pay.date) {
              const paymentDate = new Date(pay.date);
              paymentDate.setHours(0, 0, 0, 0);
              return paymentDate.getTime() >= start.getTime() && paymentDate.getTime() <= end.getTime();
            }
            // If no payment date, use purchase date
            const purchaseDate = new Date(p.date);
            purchaseDate.setHours(0, 0, 0, 0);
            return purchaseDate.getTime() >= start.getTime() && purchaseDate.getTime() <= end.getTime();
          })
          .filter((pay) => pay.type === "bank_transfer" && pay.bankAccountId === bank.bankAccountId)
          .reduce((s, pay) => s + Number(pay.amount || 0), 0);
      }, 0);
      
      const bankExpenses = expenses
        .filter((e) => {
          const expDate = new Date(e.date);
          expDate.setHours(0, 0, 0, 0);
          return expDate.getTime() >= start.getTime() && expDate.getTime() <= end.getTime();
        })
        .filter((e) => e.paymentType === "bank_transfer" && e.bankAccountId === bank.bankAccountId)
        .reduce((sum, e) => sum + Number(e.amount || 0), 0);
      
      return {
        bankAccountId: bank.bankAccountId,
        bankName: bank.bankName,
        accountNumber: bank.accountNumber,
        balance: bank.balance + bankSales - bankPurchases - bankExpenses,
      };
    });
    
    const closingBankTotal = closingBankBalances.reduce((sum, bank) => sum + bank.balance, 0);

    // Transform purchases to payment rows - each payment becomes a separate row
    const purchasesPaymentRows: any[] = [];
    purchases.forEach((purchase) => {
      const payments = (purchase.payments as Array<{ 
        type: string; 
        amount: number;
        date?: string;
        cardId?: string;
        bankAccountId?: string;
      }> | null) || [];
      
      if (payments.length > 0) {
        // Create a row for each payment
        payments.forEach((payment, paymentIndex) => {
          const paymentDate = payment.date ? new Date(payment.date) : new Date(purchase.date);
          paymentDate.setHours(0, 0, 0, 0);
          
          // Only include payments within date range
          if (paymentDate.getTime() >= start.getTime() && paymentDate.getTime() <= end.getTime()) {
            purchasesPaymentRows.push({
              ...purchase,
              // Override with payment-specific data
              date: payment.date || purchase.date,
              paymentAmount: Number(payment.amount || 0),
              paymentType: payment.type,
              paymentIndex: paymentIndex,
              paymentDate: payment.date || purchase.date,
              // Keep original total for reference
              originalTotal: Number(purchase.total || 0),
            });
          }
        });
      } else {
        // No payments array - use purchase as single row
        const purchaseDate = new Date(purchase.date);
        purchaseDate.setHours(0, 0, 0, 0);
        if (purchaseDate.getTime() >= start.getTime() && purchaseDate.getTime() <= end.getTime()) {
          purchasesPaymentRows.push({
            ...purchase,
            paymentAmount: Number(purchase.total || 0),
            paymentType: "cash", // Default if no payment type
            paymentIndex: 0,
            paymentDate: purchase.date,
            originalTotal: Number(purchase.total || 0),
          });
        }
      }
    });

    // Transform sales to payment rows - each payment becomes a separate row
    const salesPaymentRows: any[] = [];
    sales.forEach((sale) => {
      const payments = (sale.payments as Array<{ 
        type: string; 
        amount: number;
        date?: string;
        cardId?: string;
        bankAccountId?: string;
      }> | null) || [];
      
      if (payments.length > 0) {
        // Create a row for each payment
        payments.forEach((payment, paymentIndex) => {
          const paymentDate = payment.date ? new Date(payment.date) : new Date(sale.date);
          paymentDate.setHours(0, 0, 0, 0);
          
          // Only include payments within date range
          if (paymentDate.getTime() >= start.getTime() && paymentDate.getTime() <= end.getTime()) {
            salesPaymentRows.push({
              ...sale,
              // Override with payment-specific data
              date: payment.date || sale.date,
              paymentAmount: Number(payment.amount || 0),
              paymentType: payment.type,
              paymentIndex: paymentIndex,
              paymentDate: payment.date || sale.date,
              // Keep original total for reference
              originalTotal: Number(sale.total || 0),
            });
          }
        });
      } else {
        // No payments array - use sale as single row
        const saleDate = new Date(sale.date);
        saleDate.setHours(0, 0, 0, 0);
        if (saleDate.getTime() >= start.getTime() && saleDate.getTime() <= end.getTime()) {
          salesPaymentRows.push({
            ...sale,
            paymentAmount: Number(sale.total || 0),
            paymentType: sale.paymentType || "cash",
            paymentIndex: 0,
            paymentDate: sale.date,
            originalTotal: Number(sale.total || 0),
          });
        }
      }
    });

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
          banks: openingBanksWithDetails,
          cards: openingCardTotal, // Total of all cards
          total: openingCash + openingBankTotal + openingCardTotal,
        },
        sales: {
          total: salesTotal,
          cash: salesCash,
          bank_transfer: salesBankTransfer,
          count: salesPaymentRows.length, // Count of payment rows, not sales
        },
        purchases: {
          total: purchasesTotal,
          cash: purchasesCash,
          bank_transfer: purchasesBankTransfer,
          count: purchasesPaymentRows.length, // Count of payment rows, not purchases
        },
        expenses: {
          total: expensesTotal,
          cash: expensesCash,
          bank_transfer: expensesBankTransfer,
          count: expenses.length,
        },
        closingBalance: {
          cash: closingCash,
          banks: closingBankBalances,
          cards: closingCardTotal,
          total: closingCash + closingBankTotal + closingCardTotal,
        },
      },
      openingBalanceAdditions: openingBalanceAdditions.map((t) => ({
        id: t.id,
        date: t.date || t.createdAt,
        time: t.createdAt,
        type: t.type,
        amount: Number(t.amount),
        paymentType: t.paymentType,
        bankAccountId: t.bankAccountId,
        bankAccount: t.bankAccount,
        description: t.description,
        userName: t.userName,
        beforeBalance: t.beforeBalance !== null && t.beforeBalance !== undefined ? Number(t.beforeBalance) : null,
        afterBalance: t.afterBalance !== null && t.afterBalance !== undefined ? Number(t.afterBalance) : null,
        changeAmount: t.changeAmount !== null && t.changeAmount !== undefined ? Number(t.changeAmount) : null,
      })),
      dailyReports,
      sales: salesPaymentRows, // Payment rows instead of sales
      purchases: purchasesPaymentRows, // Payment rows instead of purchases
      expenses,
    };
  }
}

export default new ReportService();
