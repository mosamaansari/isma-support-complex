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
    const dateParts = date.split("-");
    const targetDate = new Date(
      parseInt(dateParts[0]), 
      parseInt(dateParts[1]) - 1, 
      parseInt(dateParts[2])
    );
    targetDate.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);
    nextDate.setHours(0, 0, 0, 0);

    // Get opening balance (most recent for the date)
    // Query by date range to handle date-only comparison properly
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);
    
    const openingBalance = await prisma.dailyOpeningBalance.findFirst({
      where: {
        date: {
          gte: targetDate,
          lte: endOfDay,
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

    // Get sales for the day - check date field, createdAt, OR payments made today
    // First get all sales that match date or createdAt
    const salesByDate = await prisma.sale.findMany({
      where: {
        status: "completed",
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
      include: {
        items: true,
        customer: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Also get sales where payments were made today (even if sale date is different)
    // We need to get all sales and filter by payments date in code
    const allSalesWithPayments = await prisma.sale.findMany({
      where: {
        payments: {
          not: null,
        },
      },
      include: {
        items: true,
        customer: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Filter sales where any payment was made today
    const salesWithTodayPayments = allSalesWithPayments.filter((sale) => {
      const payments = (sale.payments as Array<{
        type: string;
        amount: number;
        date?: string;
      }> | null) || [];
      
      return payments.some((payment) => {
        if (!payment.date) return false;
        
        // Handle different date formats (YYYY-MM-DD or ISO string)
        let paymentDate: Date;
        try {
          const dateStr = payment.date.includes("T") 
            ? payment.date.split("T")[0] 
            : payment.date;
          const paymentDateParts = dateStr.split("-");
          if (paymentDateParts.length === 3) {
            paymentDate = new Date(
              parseInt(paymentDateParts[0]),
              parseInt(paymentDateParts[1]) - 1,
              parseInt(paymentDateParts[2])
            );
          } else {
            paymentDate = new Date(payment.date);
          }
          paymentDate.setHours(0, 0, 0, 0);
          return paymentDate.getTime() === targetDate.getTime();
        } catch (e) {
          return false;
        }
      });
    });

    // Combine both and remove duplicates
    const salesMap = new Map();
    [...salesByDate, ...salesWithTodayPayments].forEach((sale) => {
      if (!salesMap.has(sale.id)) {
        salesMap.set(sale.id, sale);
      }
    });
    const sales = Array.from(salesMap.values());

    // Calculate sales totals - only count PAID AMOUNTS, not sale.total
    // Count payments made today (from sales created today OR payments made today)
    let salesTotal = 0;
    let salesCash = 0;
    let salesBankTransfer = 0;
    let salesCard = 0;
    
    sales.forEach((sale) => {
      const saleDate = sale.date ? new Date(sale.date) : new Date(sale.createdAt);
      saleDate.setHours(0, 0, 0, 0);
      const isSaleCreatedToday = saleDate.getTime() === targetDate.getTime();
      
      const payments = (sale.payments as Array<{ 
        type: string; 
        amount: number; 
        date?: string;
        cardId?: string; 
        bankAccountId?: string 
      }> | null) || [];
      
      if (isSaleCreatedToday) {
        // Sale created today - count only paid amounts (not full sale.total)
        if (payments.length > 0) {
          // Count all payments for today's sale
          payments.forEach((payment) => {
            salesTotal += Number(payment.amount || 0);
            
            if (payment.type === "cash") {
              salesCash += Number(payment.amount || 0);
            } else if (payment.type === "bank_transfer") {
              salesBankTransfer += Number(payment.amount || 0);
            } else if (payment.type === "card") {
              salesCard += Number(payment.amount || 0);
            }
          });
        } else {
          // No payments array, but sale created today - assume full amount was paid
          // This handles legacy sales without payments array
          salesTotal += Number(sale.total || 0);
          
          if (sale.paymentType === "cash") {
            salesCash += Number(sale.total);
          } else if (sale.paymentType === "bank_transfer") {
            salesBankTransfer += Number(sale.total);
          }
        }
      } else {
        // Sale not created today - only count payments made today
        payments.forEach((payment) => {
          if (!payment.date) return;
          
          try {
            const dateStr = payment.date.includes("T") 
              ? payment.date.split("T")[0] 
              : payment.date;
            const paymentDateParts = dateStr.split("-");
            if (paymentDateParts.length === 3) {
              const paymentDate = new Date(
                parseInt(paymentDateParts[0]),
                parseInt(paymentDateParts[1]) - 1,
                parseInt(paymentDateParts[2])
              );
              paymentDate.setHours(0, 0, 0, 0);
              
              if (paymentDate.getTime() === targetDate.getTime()) {
                // This payment was made today - count only this payment amount
                salesTotal += Number(payment.amount || 0);
                
                if (payment.type === "cash") {
                  salesCash += Number(payment.amount || 0);
                } else if (payment.type === "bank_transfer") {
                  salesBankTransfer += Number(payment.amount || 0);
                } else if (payment.type === "card") {
                  salesCard += Number(payment.amount || 0);
                }
              }
            }
          } catch (e) {
            // Skip invalid payment dates
          }
        });
      }
    });

    // Get purchases for the day
    const purchases = await prisma.purchase.findMany({
      where: {
        date: {
          gte: targetDate,
          lt: nextDate,
        },
      },
      include: {
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

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

    // Get expenses for the day
    const expenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: targetDate,
          lt: nextDate,
        },
      },
      orderBy: { createdAt: "desc" },
    });

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

    return {
      date: date,
      openingBalance: {
        cash: openingCash,
        cards: openingCards,
        total: openingCash + openingCardTotal,
      },
      sales: {
        total: salesTotal,
        cash: salesCash,
        bank_transfer: salesBankTransfer,
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
        cards: closingCardBalances,
        total: closingCash + closingCardTotal,
      },
    };
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
