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
    });

    // Get expenses
    const expenses = await prisma.expense.findMany({
      where: {
        date: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
      },
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
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    // Get opening balance
    const openingBalance = await prisma.dailyOpeningBalance.findUnique({
      where: { date: targetDate },
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

    // Get sales for the day
    const sales = await prisma.sale.findMany({
      where: {
        status: "completed",
        createdAt: {
          gte: targetDate,
          lt: nextDate,
        },
      },
      include: {
        items: true,
        customer: true,
      },
    });

    // Calculate sales totals
    const salesTotal = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
    const salesCash = sales.filter((s) => s.paymentType === "cash").reduce((sum, sale) => sum + Number(sale.total), 0);
    const salesBankTransfer = sales.filter((s) => s.paymentType === "bank_transfer").reduce((sum, sale) => sum + Number(sale.total), 0);

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
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Get opening balance for start date
    const openingBalance = await prisma.dailyOpeningBalance.findUnique({
      where: { date: start },
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
    });

    // Get all expenses in range
    const expenses = await prisma.expense.findMany({
      where: {
        date: {
          gte: start,
          lte: end,
        },
      },
    });

    // Calculate summary totals
    const salesTotal = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
    const salesCash = sales.filter((s) => s.paymentType === "cash").reduce((sum, sale) => sum + Number(sale.total), 0);
    const salesBankTransfer = sales.filter((s) => s.paymentType === "bank_transfer").reduce((sum, sale) => sum + Number(sale.total), 0);

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
