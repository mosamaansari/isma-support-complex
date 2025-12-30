import prisma from "../config/database";
import logger from "../utils/logger";
import PDFDocument from "pdfkit";
import { Response } from "express";

class ReportService {
  async getSalesReport(filters: { startDate?: string; endDate?: string }) {
    const where: any = { status: "completed" };

    if (filters.startDate && filters.endDate) {
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);

      where.date = {
        gte: start,
        lte: end,
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
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);

      where.date = {
        gte: start,
        lte: end,
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
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);

      dateFilter.gte = start;
      dateFilter.lte = end;
    }

    // Get sales
    const sales = await prisma.sale.findMany({
      where: {
        status: "completed",
        date: Object.keys(dateFilter).length > 0 ? dateFilter : undefined,
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

    // Fetch balance transactions for these sales
    const balanceTransactionService = (await import("./balanceTransaction.service")).default;
    let balanceTransactions: any[] = [];
    try {
      if (filters.startDate && filters.endDate) {
        balanceTransactions = await balanceTransactionService.getTransactions({
          startDate: filters.startDate,
          endDate: filters.endDate,
        });
      }
    } catch (e) {
      logger.error("Error fetching balance transactions for Sales PDF:", e);
    }

    const balanceTxMap = new Map<string, any>();
    balanceTransactions.forEach((tx: any) => {
      const normalizedPaymentType = tx.paymentType === 'card' ? 'bank_transfer' : (tx.paymentType || 'cash');
      const key = `${tx.source || ''}_${tx.sourceId || ''}_${normalizedPaymentType}`;
      balanceTxMap.set(key, tx);
    });

    const doc = new PDFDocument({ margin: 50 });

    doc.on('error', (err) => {
      logger.error("PDFkit error in Sales Report:", err);
      doc.unpipe(res);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate PDF" });
      }
    });

    // Set response headers only if not already sent
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=sales-report-${new Date().toISOString().split("T")[0]}.pdf`
      );
    }

    doc.pipe(res);

    try {
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
      doc.fontSize(12).text(`Total Sales: Rs. ${Number(report.summary.totalSales || 0).toFixed(2)}`);
      doc.text(`Total Bills: ${report.summary.totalBills}`);
      doc.text(`Average Bill: Rs. ${Number(report.summary.averageBill || 0).toFixed(2)}`);
      doc.moveDown(2);

      // Sales Details
      if (report.sales.length > 0) {
        doc.fontSize(14).text("Sales Details", { underline: true });
        doc.moveDown();

        // Headers for a table-like view
        doc.fontSize(9).font("Helvetica-Bold");
        doc.text("Bill #", 50, doc.y);
        doc.text("Customer", 120, doc.y - 9);
        doc.text("Amount", 250, doc.y - 9, { width: 70, align: "right" });
        doc.text("Before", 330, doc.y - 9, { width: 70, align: "right" });
        doc.text("After", 410, doc.y - 9, { width: 70, align: "right" });
        doc.text("Date", 490, doc.y - 9);
        doc.moveDown(0.5);
        doc.font("Helvetica");

        report.sales.forEach((sale: any) => {
          // Find balance transaction
          // Start with sale_payment, fallback to sale
          const paymentType = sale.paymentType === 'card' ? 'bank_transfer' : (sale.paymentType || 'cash');
          const key = `sale_payment_${sale.id}_${paymentType}`;
          const key2 = `sale_${sale.id}_${paymentType}`;
          const balanceTx = balanceTxMap.get(key) || balanceTxMap.get(key2);

          if (doc.y > 700) {
            doc.addPage();
          }

          const initialY = doc.y;
          doc.fontSize(9).text(sale.billNumber || 'N/A', 50, initialY);
          doc.text((sale.customerName || "Walk-in").substring(0, 20), 120, initialY);
          doc.text(`Rs. ${Number(sale.total || 0).toFixed(2)}`, 250, initialY, { width: 70, align: "right" });

          const beforeStr = balanceTx?.beforeBalance !== undefined ? `Rs. ${Number(balanceTx.beforeBalance).toFixed(2)}` : "-";
          const afterStr = balanceTx?.afterBalance !== undefined ? `Rs. ${Number(balanceTx.afterBalance).toFixed(2)}` : "-";

          doc.text(beforeStr, 330, initialY, { width: 70, align: "right" });
          doc.text(afterStr, 410, initialY, { width: 70, align: "right" });
          doc.text(new Date(sale.createdAt).toLocaleDateString(), 490, initialY);
          doc.moveDown(0.8);
        });
      } else {
        doc.fontSize(12).text("No sales found for the selected period.");
      }
    } catch (error) {
      logger.error("Error building Sales Report PDF contents:", error);
      doc.unpipe(res);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error while building PDF" });
      }
    } finally {
      doc.end();
    }
  }

  async generateExpensesReportPDF(filters: { startDate?: string; endDate?: string }, res: Response) {
    const report = await this.getExpensesReport(filters);
    const settings = await prisma.shopSettings.findFirst();

    // Fetch balance transactions for these expenses
    const balanceTransactionService = (await import("./balanceTransaction.service")).default;
    let balanceTransactions: any[] = [];
    try {
      if (filters.startDate && filters.endDate) {
        balanceTransactions = await balanceTransactionService.getTransactions({
          startDate: filters.startDate,
          endDate: filters.endDate,
        });
      }
    } catch (e) {
      logger.error("Error fetching balance transactions for Expenses PDF:", e);
    }

    const balanceTxMap = new Map<string, any>();
    balanceTransactions.forEach((tx: any) => {
      const normalizedPaymentType = tx.paymentType === 'card' ? 'bank_transfer' : (tx.paymentType || 'cash');
      const key = `${tx.source || ''}_${tx.sourceId || ''}_${normalizedPaymentType}`;
      balanceTxMap.set(key, tx);
    });

    const doc = new PDFDocument({ margin: 50 });

    doc.on('error', (err) => {
      logger.error("PDFkit error in Expenses Report:", err);
      doc.unpipe(res);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate PDF" });
      }
    });

    // Set response headers only if not already sent
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=expenses-report-${new Date().toISOString().split("T")[0]}.pdf`
      );
    }

    doc.pipe(res);

    try {
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
      doc.fontSize(12).text(`Total Expenses: Rs. ${Number(report.summary.totalExpenses || 0).toFixed(2)}`);
      doc.moveDown();

      // Category Breakdown
      if (report.summary.categoryTotals && Object.keys(report.summary.categoryTotals).length > 0) {
        doc.fontSize(14).text("Category Breakdown", { underline: true });
        doc.moveDown();
        Object.entries(report.summary.categoryTotals).forEach(([category, total]) => {
          doc.fontSize(11).text(`${category}: Rs. ${Number(total || 0).toFixed(2)}`);
        });
        doc.moveDown(2);
      }

      // Expense Details
      if (report.expenses.length > 0) {
        doc.fontSize(14).text("Expense Details", { underline: true });
        doc.moveDown();

        // Headers
        const tableTop = doc.y;
        doc.fontSize(9).font("Helvetica-Bold");
        doc.text("Description", 50, tableTop);
        doc.text("Amount", 250, tableTop, { width: 70, align: "right" });
        doc.text("Before", 330, tableTop, { width: 70, align: "right" });
        doc.text("After", 410, tableTop, { width: 70, align: "right" });
        doc.text("Category/Date", 490, tableTop);
        doc.moveDown(0.5);
        doc.font("Helvetica");

        report.expenses.forEach((expense: any) => {
          const key = `expense_${expense.id}_${expense.paymentType || 'cash'}`;
          const balanceTx = balanceTxMap.get(key);

          if (doc.y > 700) {
            doc.addPage();
          }

          const initialY = doc.y;
          doc.fontSize(9).text((expense.description || '').substring(0, 30), 50, initialY);
          doc.text(`Rs. ${Number(expense.amount || 0).toFixed(2)}`, 250, initialY, { width: 70, align: "right" });

          const beforeStr = balanceTx?.beforeBalance !== undefined ? `Rs. ${Number(balanceTx.beforeBalance).toFixed(2)}` : "-";
          const afterStr = balanceTx?.afterBalance !== undefined ? `Rs. ${Number(balanceTx.afterBalance).toFixed(2)}` : "-";

          doc.text(beforeStr, 330, initialY, { width: 70, align: "right" });
          doc.text(afterStr, 410, initialY, { width: 70, align: "right" });
          doc.text(`${expense.category} | ${new Date(expense.date).toLocaleDateString()}`, 490, initialY);
          doc.moveDown(0.8);
        });
      } else {
        doc.fontSize(12).text("No expenses found for the selected period.");
      }
    } catch (error) {
      logger.error("Error building Expenses Report PDF contents:", error);
      doc.unpipe(res);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error while building PDF" });
      }
    } finally {
      doc.end();
    }
  }

  async generateProfitLossReportPDF(filters: { startDate?: string; endDate?: string }, res: Response) {
    const report = await this.getProfitLossReport(filters);
    const settings = await prisma.shopSettings.findFirst();

    const doc = new PDFDocument({ margin: 50 });

    doc.on('error', (err) => {
      logger.error("PDFkit error in Profit/Loss Report:", err);
      doc.unpipe(res);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to generate PDF" });
      }
    });

    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=profit-loss-report-${new Date().toISOString().split("T")[0]}.pdf`
      );
    }

    doc.pipe(res);

    try {
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
      doc.fontSize(12).text(`Total Sales: Rs. ${Number(report.totalSales || 0).toFixed(2)}`);
      doc.text(`Total Expenses: Rs. ${Number(report.totalExpenses || 0).toFixed(2)}`);
      doc.moveDown();
      doc.fontSize(14).text(`Profit: Rs. ${Number(report.profit || 0).toFixed(2)}`, { underline: true });
      doc.text(`Profit Margin: ${Number(report.profitMargin || 0).toFixed(2)}%`);
    } catch (error) {
      logger.error("Error building Profit/Loss Report PDF contents:", error);
      doc.unpipe(res);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error while building PDF" });
      }
    } finally {
      doc.end();
    }
  }

  async getDailyReport(date: string) {
    // Parse date string (YYYY-MM-DD) properly to avoid timezone issues
    logger.info(`Getting daily report for date: ${date}`);
    const dateParts = date.split("-");
    if (dateParts.length !== 3) {
      throw new Error(`Invalid date format: ${date}. Expected YYYY-MM-DD`);
    }

    // Create date at noon UTC to avoid timezone issues, then convert to local date
    const utcDate = new Date(Date.UTC(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1,
      parseInt(dateParts[2]),
      12, 0, 0, 0 // Noon UTC to avoid daylight saving issues
    ));

    // Convert to local date components
    const localYear = utcDate.getFullYear();
    const localMonth = utcDate.getMonth();
    const localDate = utcDate.getDate();

    // Create targetDate using local date components
    const targetDate = new Date(localYear, localMonth, localDate, 0, 0, 0, 0);

    const nextDate = new Date(localYear, localMonth, localDate + 1, 0, 0, 0, 0);

    logger.info(`Parsed date ${date} -> targetDate: ${targetDate.toISOString()}, nextDate: ${nextDate.toISOString()}`);
    const dailyClosingBalanceService = (await import("./dailyClosingBalance.service")).default;
    const balanceTransactionService = (await import("./balanceTransaction.service")).default;

    // Recalculate and fetch the current closing balance record (source of truth from ledger)
    const closingBalanceRecord = await dailyClosingBalanceService.calculateAndStoreClosingBalance(targetDate);

    // Get baseline opening balance record
    const openingBalance = await prisma.dailyOpeningBalance.findFirst({
      where: {
        date: {
          gte: targetDate,
          lt: nextDate,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    let openingCash = 0;
    let openingBankBalances: any[] = [];
    let openingCardBalances: any[] = [];

    if (openingBalance) {
      openingCash = Number(openingBalance.cashBalance || 0);
      openingBankBalances = (openingBalance.bankBalances as any[]) || [];
      openingCardBalances = (openingBalance.cardBalances as any[]) || [];
    } else {
      const prevClosing = await dailyClosingBalanceService.getPreviousDayClosingBalance(date);
      if (prevClosing) {
        openingCash = Number(prevClosing.cashBalance || 0);
        openingBankBalances = (prevClosing.bankBalances as any[]) || [];
        openingCardBalances = (prevClosing.cardBalances as any[]) || [];
      }
    }

    const cards = await prisma.card.findMany();
    const cardMap = new Map(cards.map((card) => [card.id, card]));
    const banks = await prisma.bankAccount.findMany();
    const bankMap = new Map(banks.map((bank) => [bank.id, bank]));

    const mapBanks = (bals: any[]) => bals.map(b => ({
      ...b,
      bankName: bankMap.get(b.bankAccountId)?.bankName || "Unknown",
      accountNumber: bankMap.get(b.bankAccountId)?.accountNumber || "",
      balance: Number(b.balance)
    }));

    const mapCards = (bals: any[]) => bals.map(cb => ({
      ...cb,
      cardName: cardMap.get(cb.cardId)?.name || "Unknown",
      balance: Number(cb.balance)
    }));

    // Fetch transactions
    const transactions = await balanceTransactionService.getTransactions({
      startDate: date,
      endDate: date,
    });

    const openingBalanceAdditions = transactions
      .filter((t: any) => (t.source || "").includes("opening_balance") || t.source === "add_opening_balance")
      .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    // Extract IDs from transactions to fetch involved sales and purchases
    // We use startsWith to catch both 'sale' and 'sale_payment', 'purchase' and 'purchase_payment'
    const saleIds = transactions.filter(t => (t.source || "").startsWith("sale")).map(t => t.sourceId).filter(Boolean);
    const purchaseIds = transactions.filter(t => (t.source || "").startsWith("purchase")).map(t => t.sourceId).filter(Boolean);

    // Fetch core items for the day - include those with transactions today OR created today
    const sales = await prisma.sale.findMany({
        where: {
          OR: [
            { date: { gte: targetDate, lt: nextDate } },
            { id: { in: saleIds as string[] } }
          ]
        },
      include: { customer: true }
    });

    const purchases = await prisma.purchase.findMany({
      where: {
        OR: [
          { date: { gte: targetDate, lt: nextDate } },
          { id: { in: purchaseIds as string[] } }
        ]
      },
      include: { supplier: true }
    });

    const expenses = await prisma.expense.findMany({
      where: { date: { gte: targetDate, lt: nextDate } }
    });

    // Helper for payment breakdown
    const getPaymentRows = (items: any[]) => {
      const rows: any[] = [];
      items.forEach(item => {
        const payments = (item.payments as any[]) || [];
        if (payments.length > 0) {
          payments.forEach((p, idx) => {
            const pDate = p.date ? new Date(p.date) : new Date(item.date);
            // Robust comparison for same day
            const isSameDay = pDate.getFullYear() === targetDate.getFullYear() &&
              pDate.getMonth() === targetDate.getMonth() &&
              pDate.getDate() === targetDate.getDate();

            if (isSameDay) {
              rows.push({
                ...item,
                paymentAmount: Number(p.amount),
                paymentType: p.type,
                paymentDate: p.date || item.date,
                paymentIndex: idx
              });
            }
          });
        } else {
          const iDate = new Date(item.date);
          const isSameDay = iDate.getFullYear() === targetDate.getFullYear() &&
            iDate.getMonth() === targetDate.getMonth() &&
            iDate.getDate() === targetDate.getDate();

          if (isSameDay) {
            rows.push({
              ...item,
              paymentAmount: Number(item.total),
              paymentType: item.paymentType || "cash",
              paymentDate: item.date,
              paymentIndex: 0
            });
          }
        }
      });
      return rows;
    };

    const salesPaymentRows = getPaymentRows(sales);
    const purchasesPaymentRows = getPaymentRows(purchases);

    // Calculate totals for report view
    const salesTotal = salesPaymentRows.reduce((s, r) => s + r.paymentAmount, 0);
    const purchasesTotal = purchasesPaymentRows.reduce((s, r) => s + r.paymentAmount, 0);
    const expensesTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);

    const cashSales = salesPaymentRows.filter((r: any) => r.paymentType === 'cash').reduce((s, r) => s + r.paymentAmount, 0);
    const bankSales = salesPaymentRows.filter((r: any) => r.paymentType === 'bank_transfer').reduce((s, r) => s + r.paymentAmount, 0);
    const cardSales = salesPaymentRows.filter((r: any) => r.paymentType === 'card').reduce((s, r) => s + r.paymentAmount, 0);

    const cashPurchases = purchasesPaymentRows.filter((r: any) => r.paymentType === 'cash').reduce((s, r) => s + r.paymentAmount, 0);
    const bankPurchases = purchasesPaymentRows.filter((r: any) => r.paymentType === 'bank_transfer').reduce((s, r) => s + r.paymentAmount, 0);
    const cardPurchases = purchasesPaymentRows.filter((r: any) => r.paymentType === 'card').reduce((s, r) => s + r.paymentAmount, 0);

    const cashExpenses = expenses.filter((e: any) => e.paymentType === 'cash').reduce((s, e) => s + Number(e.amount), 0);
    const bankExpenses = expenses.filter((e: any) => e.paymentType === 'bank_transfer').reduce((s, e) => s + Number(e.amount), 0);
    const cardExpenses = expenses.filter((e: any) => e.paymentType === 'card').reduce((s, e) => s + Number(e.amount), 0);

    return {
      date,
      openingBalance: {
        cash: openingCash,
        banks: mapBanks(openingBankBalances),
        cards: mapCards(openingCardBalances),
        total: openingCash + openingBankBalances.reduce((s, b) => s + Number(b.balance), 0) + openingCardBalances.reduce((s, b) => s + Number(b.balance), 0)
      },
      closingBalance: {
        cash: Number(closingBalanceRecord.cashBalance),
        banks: mapBanks((closingBalanceRecord.bankBalances as any[]) || []),
        cards: mapCards((closingBalanceRecord.cardBalances as any[]) || []),
        total: Number(closingBalanceRecord.cashBalance) +
          ((closingBalanceRecord.bankBalances as any[]) || []).reduce((s, b) => s + Number(b.balance), 0) +
          ((closingBalanceRecord.cardBalances as any[]) || []).reduce((s, b) => s + Number(b.balance), 0)
      },
      openingBalanceAdditions: openingBalanceAdditions.map((t: any) => ({
        ...t,
        amount: Number(t.amount),
        beforeBalance: t.beforeBalance ? Number(t.beforeBalance) : null,
        afterBalance: t.afterBalance ? Number(t.afterBalance) : null,
        changeAmount: t.changeAmount ? Number(t.changeAmount) : null
      })),
      sales: {
        total: salesTotal,
        cash: cashSales,
        bank_transfer: bankSales,
        card: cardSales,
        count: salesPaymentRows.length,
        items: salesPaymentRows
      },
      purchases: {
        total: purchasesTotal,
        cash: cashPurchases,
        bank_transfer: bankPurchases,
        card: cardPurchases,
        count: purchasesPaymentRows.length,
        items: purchasesPaymentRows
      },
      expenses: {
        total: expensesTotal,
        cash: cashExpenses,
        bank_transfer: bankExpenses,
        card: cardExpenses,
        count: expenses.length,
        items: expenses
      }
    };
  }

  /**
   * Generate comprehensive daily report PDF with chronological order and before/after balances
   */
  async generateDailyReportPDF(date: string, res: Response) {
    try {
      const report = await this.getDailyReport(date);
      const settings = await prisma.shopSettings.findFirst();
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
        // Keep card payments separate
        const normalizedPaymentType = tx.paymentType || 'cash';

        // Match by source and sourceId, then by paymentType
        const key = `${tx.source || ''}_${tx.sourceId || ''}_${normalizedPaymentType}`;
        if (!balanceTxMap.get(key)) {
          balanceTxMap.set(key, []);
        }
        balanceTxMap.get(key)!.push(tx);
      });

      const doc = new PDFDocument({ margin: 50 });

      doc.on('error', (err) => {
        logger.error("PDFkit error in Daily Report:", err);
        doc.unpipe(res);
        if (!res.headersSent) {
          res.status(500).json({ error: "Failed to generate PDF" });
        }
      });

      // Set response headers only if not already sent
      if (!res.headersSent) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=daily-report-${date}.pdf`
        );
      }

      doc.pipe(res);

      // Header
      doc.fontSize(20).text(settings?.shopName || "Isma Sports Complex", { align: "center" });
      doc.moveDown();
      doc.fontSize(16).text("Daily Financial Report", { align: "center" });
      doc.fontSize(12).text(`Date: ${new Date(date).toLocaleDateString()}`, { align: "center" });
      doc.moveDown(2);

      // Opening Balance Section
      doc.fontSize(16).text("Opening Balance", { underline: true });
      doc.moveDown();

      // Cash Balance Card
      doc.rect(50, doc.y, 200, 40).fillColor('#dbeafe').fill();
      doc.fillColor('black');
      doc.fontSize(10).text("Cash Balance", 55, doc.y + 5);
      doc.fontSize(18).font("Helvetica-Bold").fillColor('#2563eb');
      doc.text(`Rs. ${Number(report.openingBalance.cash || 0).toFixed(2)}`, 55, doc.y + 15);
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
      doc.text(`Rs. ${Number(report.openingBalance.total || 0).toFixed(2)}`, 55, doc.y + 15);
      doc.fillColor('black');
      doc.moveDown(1.5);

      // Transactions
      const allTransactions: any[] = [];

      if (report.openingBalanceAdditions && report.openingBalanceAdditions.length > 0) {
        report.openingBalanceAdditions.forEach((add: any) => {
          allTransactions.push({
            type: 'Balance Add',
            datetime: new Date(add.time || add.date || date),
            paymentType: add.paymentType,
            amount: Number(add.amount || 0),
            beforeBalance: add.beforeBalance,
            afterBalance: add.afterBalance,
            source: 'Manual Add',
            description: add.description || 'Opening Balance Addition',
            bankName: add.bankAccount?.bankName || '',
          });
        });
      }

      if (report.purchases?.items?.length > 0) {
        report.purchases.items.forEach((purchaseRow: any) => {
          const paymentDate = purchaseRow.paymentDate ? new Date(purchaseRow.paymentDate) : (purchaseRow.date ? new Date(purchaseRow.date) : new Date(purchaseRow.createdAt));
          const paymentType = purchaseRow.paymentType === 'card' ? 'bank_transfer' : (purchaseRow.paymentType || 'cash');
          const key = `purchase_payment_${purchaseRow.id}_${paymentType}`;
          const balanceTxs = balanceTxMap.get(key) || balanceTxMap.get(`purchase_${purchaseRow.id}_${paymentType}`) || [];
          const balanceTx = balanceTxs.length > 0 ? balanceTxs[0] : null;

          allTransactions.push({
            type: 'Purchase',
            datetime: paymentDate,
            paymentType: purchaseRow.paymentType || 'cash',
            amount: Number(purchaseRow.paymentAmount || purchaseRow.total || 0),
            beforeBalance: balanceTx?.beforeBalance,
            afterBalance: balanceTx?.afterBalance,
            source: purchaseRow.supplierName || 'N/A',
            description: `Ref ID: ${purchaseRow.id.substring(0, 8)}`,
            bankName: purchaseRow.bankAccount?.bankName || '',
          });
        });
      }

      if (report.sales?.items?.length > 0) {
        report.sales.items.forEach((saleRow: any) => {
          const paymentDate = saleRow.paymentDate ? new Date(saleRow.paymentDate) : (saleRow.date ? new Date(saleRow.date) : new Date(saleRow.createdAt));
          const paymentType = saleRow.paymentType === 'card' ? 'bank_transfer' : (saleRow.paymentType || 'cash');
          const key = `sale_payment_${saleRow.id}_${paymentType}`;
          const balanceTxs = balanceTxMap.get(key) || balanceTxMap.get(`sale_${saleRow.id}_${paymentType}`) || [];
          const balanceTx = balanceTxs.length > 0 ? balanceTxs[0] : null;

          allTransactions.push({
            type: 'Sale',
            datetime: paymentDate,
            paymentType: saleRow.paymentType || 'cash',
            amount: Number(saleRow.paymentAmount || saleRow.total || 0),
            beforeBalance: balanceTx?.beforeBalance,
            afterBalance: balanceTx?.afterBalance,
            source: saleRow.billNumber || 'N/A',
            description: saleRow.customerName || 'Walk-in',
            bankName: saleRow.bankAccount?.bankName || '',
          });
        });
      }

      if (report.expenses?.items?.length > 0) {
        report.expenses.items.forEach((expense: any) => {
          const key = `expense_${expense.id}_${expense.paymentType || 'cash'}`;
          const balanceTxs = balanceTxMap.get(key) || [];
          const balanceTx = balanceTxs.length > 0 ? balanceTxs[0] : null;

          allTransactions.push({
            type: 'Expense',
            datetime: new Date(expense.createdAt),
            paymentType: expense.paymentType || 'cash',
            amount: Number(expense.amount || 0),
            beforeBalance: balanceTx?.beforeBalance,
            afterBalance: balanceTx?.afterBalance,
            source: expense.category || 'N/A',
            description: (expense.description || '').substring(0, 20),
            bankName: expense.bankAccountId ? 'Bank Transfer' : '',
          });
        });
      }

      allTransactions.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

      if (allTransactions.length > 0) {
        doc.fontSize(14).text("Chronological Transaction Details", { underline: true });
        doc.moveDown();

        const rowHeight = 18;
        const colWidths = [35, 40, 55, 85, 45, 45, 60, 65, 65];
        let currentY = doc.y;

        // Header
        doc.rect(50, currentY - 5, 495, rowHeight).fillColor('#f3f4f6').fill();
        doc.fillColor('black').font("Helvetica-Bold").fontSize(7);
        doc.text("Time", 55, currentY);
        doc.text("Type", 55 + colWidths[0], currentY);
        doc.text("Source", 55 + colWidths[0] + colWidths[1], currentY);
        doc.text("Description", 55 + colWidths[0] + colWidths[1] + colWidths[2], currentY);
        doc.text("Pay Type", 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], currentY);
        doc.text("Bank", 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], currentY);
        doc.text("Before", 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5], currentY, { width: colWidths[6], align: "right" });
        doc.text("Change", 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6], currentY, { width: colWidths[7], align: "right" });
        doc.text("After", 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6] + colWidths[7], currentY, { width: colWidths[8], align: "right" });

        currentY += rowHeight;
        doc.font("Helvetica").fontSize(6.5);

        allTransactions.forEach((tran, index) => {
          if (currentY > 750) {
            doc.addPage();
            currentY = 50;
            // Draw header again on new page
            doc.rect(50, currentY - 5, 495, rowHeight).fillColor('#f3f4f6').fill();
            doc.fillColor('black').font("Helvetica-Bold").fontSize(7);
            doc.text("Time", 55, currentY);
            doc.text("Type", 55 + colWidths[0], currentY);
            doc.text("Source", 55 + colWidths[0] + colWidths[1], currentY);
            doc.text("Description", 55 + colWidths[0] + colWidths[1] + colWidths[2], currentY);
            doc.text("Pay Type", 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], currentY);
            doc.text("Bank", 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], currentY);
            doc.text("Before", 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5], currentY, { width: colWidths[6], align: "right" });
            doc.text("Change", 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6], currentY, { width: colWidths[7], align: "right" });
            doc.text("After", 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6] + colWidths[7], currentY, { width: colWidths[8], align: "right" });
            currentY += rowHeight;
            doc.font("Helvetica").fontSize(6.5);
          }

          const isIncome = tran.type === 'Sale' || tran.type === 'Balance Add';
          if (index % 2 === 0) {
            doc.rect(50, currentY - 3, 495, rowHeight).fillColor(isIncome ? '#f0fdf4' : '#fef2f2').fill();
          }
          doc.fillColor('black');

          const timeStr = tran.datetime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          doc.text(timeStr, 55, currentY, { width: colWidths[0] });
          doc.text(tran.type, 55 + colWidths[0], currentY, { width: colWidths[1] });
          doc.text((tran.source || '-'), 55 + colWidths[0] + colWidths[1], currentY, { width: colWidths[2] });
          doc.text((tran.description || ''), 55 + colWidths[0] + colWidths[1] + colWidths[2], currentY, { width: colWidths[3] });
          doc.text(tran.paymentType, 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], currentY, { width: colWidths[4] });
          doc.text(tran.bankName ? 'Bank' : '-', 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4], currentY, { width: colWidths[5] });

          const beforeStr = tran.beforeBalance !== undefined && tran.beforeBalance !== null ? Number(tran.beforeBalance).toFixed(2) : '-';
          const changeStr = (isIncome ? '+' : '-') + Number(tran.amount).toFixed(2);
          const afterStr = tran.afterBalance !== undefined && tran.afterBalance !== null ? Number(tran.afterBalance).toFixed(2) : '-';

          doc.text(beforeStr, 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5], currentY, { width: colWidths[6], align: "right" });
          doc.fillColor(isIncome ? '#16a34a' : '#dc2626').text(changeStr, 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6], currentY, { width: colWidths[7], align: "right" });
          doc.fillColor('black').text(afterStr, 55 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] + colWidths[4] + colWidths[5] + colWidths[6] + colWidths[7], currentY, { width: colWidths[8], align: "right" });

          currentY += rowHeight;
        });

        doc.moveDown(2);
      }

      // Final Summary
      doc.fontSize(14).text("Summary", { underline: true });
      doc.moveDown();
      doc.fontSize(10);
      doc.text(`Total Sales: Rs. ${Number(report.sales.total || 0).toFixed(2)}`);
      doc.text(`Total Purchases: Rs. ${Number(report.purchases.total || 0).toFixed(2)}`);
      doc.text(`Total Expenses: Rs. ${Number(report.expenses.total || 0).toFixed(2)}`);
      doc.moveDown();
      doc.fontSize(12).font("Helvetica-Bold");
      doc.text(`Closing Balance: Rs. ${Number(report.closingBalance.total || 0).toFixed(2)}`);

      doc.end();
    } catch (error) {
      logger.error("Error building Daily Report PDF contents:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error while building PDF" });
      }
    }
  }

  async getDateRangeReport(startDate: string, endDate: string) {

    // Parse dates properly to avoid timezone issues
    const startParts = startDate.split("-");
    const endParts = endDate.split("-");

    // Create dates at noon UTC to avoid timezone issues, then convert to local date
    const startUtc = new Date(Date.UTC(
      parseInt(startParts[0]),
      parseInt(startParts[1]) - 1,
      parseInt(startParts[2]),
      12, 0, 0, 0 // Noon UTC to avoid daylight saving issues
    ));

    const endUtc = new Date(Date.UTC(
      parseInt(endParts[0]),
      parseInt(endParts[1]) - 1,
      parseInt(endParts[2]),
      12, 0, 0, 0 // Noon UTC to avoid daylight saving issues
    ));

    // Convert to local date components
    const startYear = startUtc.getFullYear();
    const startMonth = startUtc.getMonth();
    const startDay = startUtc.getDate();

    const endYear = endUtc.getFullYear();
    const endMonth = endUtc.getMonth();
    const endDay = endUtc.getDate();

    // Create start and end dates using local date components
    const start = new Date(startYear, startMonth, startDay, 0, 0, 0, 0);
    const end = new Date(endYear, endMonth, endDay, 23, 59, 59, 999);


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

    // Get balance transactions for opening balance additions
    const balanceTransactionService = (await import("./balanceTransaction.service")).default;
    const transactions = await balanceTransactionService.getTransactions({
      startDate: startDate,
      endDate: endDate,
    });

    // Fetch records within a broader date range to catch payments that might be on records created earlier/later
    // We'll filter them based on payment dates later
    const broadStart = new Date(startYear, startMonth, startDay - 30); // 30 days before
    const broadEnd = new Date(endYear, endMonth, endDay + 30); // 30 days after

    const [allSales, allPurchases, expenses] = await Promise.all([
      prisma.sale.findMany({
        where: {
          date: { gte: broadStart, lte: broadEnd }
        },
        include: { items: true, customer: true, card: true, bankAccount: true, payments: true } as any,
        orderBy: { createdAt: "desc" }
      }),
      prisma.purchase.findMany({
        where: {
          date: { gte: broadStart, lte: broadEnd }
        },
        include: { items: true, supplier: true, payments: true } as any,
        orderBy: { createdAt: "desc" }
      }),
      prisma.expense.findMany({
        where: { date: { gte: start, lte: end } },
        orderBy: { createdAt: "desc" }
      })
    ]);

    // For date range reports, include all records within the date range
    // (no payment date filtering needed - show all activity for the period)
    const sales = allSales.filter((sale) => {
      const saleDate = new Date(sale.date);
      const sYear = saleDate.getFullYear();
      const sMonth = saleDate.getMonth();
      const sDay = saleDate.getDate();
      const saleLocalDate = new Date(sYear, sMonth, sDay);

      const startYear = start.getFullYear();
      const startMonth = start.getMonth();
      const startDay = start.getDate();
      const startLocalDate = new Date(startYear, startMonth, startDay);

      const endYear = end.getFullYear();
      const endMonth = end.getMonth();
      const endDay = end.getDate();
      const endLocalDate = new Date(endYear, endMonth, endDay);

      return saleLocalDate.getTime() >= startLocalDate.getTime() && saleLocalDate.getTime() <= endLocalDate.getTime();
    });

    const purchases = allPurchases.filter((purchase) => {
      const purchaseDate = new Date(purchase.date);
      const pYear = purchaseDate.getFullYear();
      const pMonth = purchaseDate.getMonth();
      const pDay = purchaseDate.getDate();
      const purchaseLocalDate = new Date(pYear, pMonth, pDay);

      const startYear = start.getFullYear();
      const startMonth = start.getMonth();
      const startDay = start.getDate();
      const startLocalDate = new Date(startYear, startMonth, startDay);

      const endYear = end.getFullYear();
      const endMonth = end.getMonth();
      const endDay = end.getDate();
      const endLocalDate = new Date(endYear, endMonth, endDay);

      return purchaseLocalDate.getTime() >= startLocalDate.getTime() && purchaseLocalDate.getTime() <= endLocalDate.getTime();
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
    let openingBalanceAdditions: any[] = [];
    try {
      openingBalanceAdditions = transactions
        .filter((t: any) => (t.source || "").includes("opening_balance") || t.source === "add_opening_balance")
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

    // Create combined transactions list like in daily report, sorted chronologically
    const allTransactions: any[] = [];

    // Add opening balance additions
    if (openingBalanceAdditions && openingBalanceAdditions.length > 0) {
      openingBalanceAdditions.forEach((add: any) => {
        allTransactions.push({
          type: 'Balance Add',
          datetime: new Date(add.time || add.date || startDate),
          paymentType: add.paymentType,
          amount: Number(add.amount || 0),
          beforeBalance: add.beforeBalance,
          afterBalance: add.afterBalance,
          source: 'Manual Add',
          description: add.description || 'Opening Balance Addition',
          bankName: add.bankAccount?.bankName || '',
        });
      });
    }

    // Add purchase payments (from all purchases in the period)
    purchases.forEach((purchase: any) => {
      if (purchase.payments && purchase.payments.length > 0) {
        purchase.payments.forEach((payment: any) => {
          allTransactions.push({
            type: 'Purchase',
            datetime: new Date(payment.date || purchase.date),
            paymentType: payment.type || purchase.paymentType || 'cash',
            amount: Number(payment.amount || 0),
            beforeBalance: null,
            afterBalance: null,
            source: purchase.supplierName || 'N/A',
            description: `Ref ID: ${purchase.id.substring(0, 8)}`,
            bankName: purchase.bankAccount?.bankName || '',
          });
        });
      } else {
        // No payments, show the purchase total
        allTransactions.push({
          type: 'Purchase',
          datetime: new Date(purchase.date),
          paymentType: 'cash',
          amount: Number(purchase.total || 0),
          beforeBalance: null,
          afterBalance: null,
          source: purchase.supplierName || 'N/A',
          description: `Ref ID: ${purchase.id.substring(0, 8)}`,
          bankName: '',
        });
      }
    });

    // Add sales payments (from all sales in the period)
    sales.forEach((sale: any) => {
      if (sale.payments && sale.payments.length > 0) {
        sale.payments.forEach((payment: any) => {
          allTransactions.push({
            type: 'Sale',
            datetime: new Date(payment.date || sale.date),
            paymentType: payment.type || sale.paymentType || 'cash',
            amount: Number(payment.amount || 0),
            beforeBalance: null,
            afterBalance: null,
            source: sale.billNumber || 'N/A',
            description: sale.customerName || 'Walk-in',
            bankName: sale.bankAccount?.bankName || '',
          });
        });
      } else {
        // No payments, show the sale total
        allTransactions.push({
          type: 'Sale',
          datetime: new Date(sale.date),
          paymentType: sale.paymentType || 'cash',
          amount: Number(sale.total || 0),
          beforeBalance: null,
          afterBalance: null,
          source: sale.billNumber || 'N/A',
          description: sale.customerName || 'Walk-in',
          bankName: sale.bankAccount?.bankName || '',
        });
      }
    });

    // Add expenses
    if (expenses && expenses.length > 0) {
      expenses.forEach((expense: any) => {
        allTransactions.push({
          type: 'Expense',
          datetime: new Date(expense.createdAt),
          paymentType: expense.paymentType || 'cash',
          amount: Number(expense.amount || 0),
          beforeBalance: null,
          afterBalance: null,
          source: expense.category || 'N/A',
          description: (expense.description || '').substring(0, 20),
          bankName: expense.bankAccountId ? 'Bank Transfer' : '',
        });
      });
    }

    // Sort all transactions by datetime (ascending - oldest first)
    allTransactions.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

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
      // Return combined sorted transactions instead of separate arrays
      transactions: allTransactions,
      // Return filtered full records for individual sections
      sales: sales,
      purchases: purchases,
      expenses,
    };
  }
}

export default new ReportService();
