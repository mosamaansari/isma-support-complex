import prisma from "../config/database";
import logger from "../utils/logger";
import { formatLocalYMD, getTodayInPakistan } from "../utils/date";

class DashboardService {
  async getDashboardStats() {
    try {
      // Get today's date in Pakistan timezone (start of day)
      const todayPakistan = getTodayInPakistan(); // Returns date with 00:00:00 in Pakistan timezone
      const todayStr = formatLocalYMD(todayPakistan); // YYYY-MM-DD string
      
      // For database queries, we need Date objects
      // Create start and end of today in local timezone
      const today = new Date(todayPakistan);
      today.setHours(0, 0, 0, 0);
      
      // End of today in local time
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      // Get all sales to check for payments made today
      const allSales = await prisma.sale.findMany({
        select: {
          id: true,
          total: true,
          remainingBalance: true,
          status: true,
          date: true,
          createdAt: true,
          payments: true,
        },
        orderBy: { createdAt: "desc" },
      });

      // Calculate today's sales based on:
      // 1. Sales created/completed today (count full sale total)
      // 2. Payments made today to existing sales (count payment amounts only)
      let todaySalesTotal = 0;

      // Calculate today's sales (only non-cancelled, non-refunded)
      // Use createdAt to check if sale was created today
      // Only count sale.total amount, not payment amounts
      let todaySalesNonCancelled = 0;
      const todaySalesNonCancelledList = allSales.filter((sale) => {
        // Use createdAt to check if sale was created today
        const saleCreatedAt = new Date(sale.createdAt);
        // Convert to local date string for comparison (handles timezone properly)
        const saleDateStr = formatLocalYMD(saleCreatedAt);
        // Exclude cancelled sales and check if created today
        return saleDateStr === todayStr && sale.status !== "cancelled";
      });
      // Sum only the sale.total amounts (not payment amounts)
      todaySalesNonCancelled = todaySalesNonCancelledList.reduce(
        (sum, sale) => sum + Number(sale.total || 0),
        0
      );

      // Calculate today's purchases (only non-cancelled)
      // Use createdAt to check if purchase was created today
      const allPurchases = await prisma.purchase.findMany({
        where: {
          status: {
            not: "cancelled",
          },
        },
        select: {
          total: true,
          createdAt: true,
        },
      });
      
      // Filter purchases by createdAt date string to handle timezone properly
      // Only count purchases created today
      const todayPurchasesFiltered = allPurchases.filter((purchase) => {
        const purchaseCreatedAt = new Date(purchase.createdAt);
        const purchaseDateStr = formatLocalYMD(purchaseCreatedAt);
        return purchaseDateStr === todayStr;
      });
      
      // Sum only the purchase.total amounts
      const todayPurchasesNonCancelled = todayPurchasesFiltered.reduce(
        (sum, purchase) => sum + Number(purchase.total || 0),
        0
      );

      // Calculate todaySalesTotal (for backward compatibility, but not used in todaySalesNonCancelled)
      // This is kept for other metrics but todaySalesNonCancelled uses only sale.total
      allSales.forEach((sale) => {
        if (sale.status === "cancelled") return; // Skip cancelled sales
        
        const saleDate = sale.date ? new Date(sale.date) : new Date(sale.createdAt);
        const saleDateStr = formatLocalYMD(saleDate);
        const saleCreatedToday = saleDateStr === todayStr;
        const isCompletedToday = saleCreatedToday && sale.status === "completed";
        
        // If sale was created and completed today, count the full sale total
        if (isCompletedToday) {
          todaySalesTotal += Number(sale.total || 0);
          return;
        }

        // Check payments made today for sales not created today
        const payments = (sale.payments as Array<{
          type: string;
          amount: number;
          date?: string;
        }>) || [];
        
        payments.forEach((payment) => {
          if (payment.date) {
            const paymentDateStr = formatLocalYMD(new Date(payment.date));
            if (paymentDateStr === todayStr) {
              todaySalesTotal += Number(payment.amount || 0);
            }
          } else if (saleCreatedToday && !isCompletedToday) {
            todaySalesTotal += Number(payment.amount || 0);
          }
        });
      });

      // Total sales (all time, excluding cancelled)
      const totalSalesResult = await prisma.sale.aggregate({
        where: {
          status: {
            not: "cancelled",
          },
        },
        _sum: {
          total: true,
        },
      });
      const totalSales = Number(totalSalesResult._sum.total || 0);

      // Total expenses
      const totalExpensesResult = await prisma.expense.aggregate({
        _sum: {
          amount: true,
        },
      });
      const totalExpenses = Number(totalExpensesResult._sum.amount || 0);

      // Total purchases (excluding cancelled)
      const totalPurchasesResult = await prisma.purchase.aggregate({
        where: {
          status: {
            not: "cancelled",
          },
        },
        _sum: {
          total: true,
        },
      });
      const totalPurchases = Number(totalPurchasesResult._sum.total || 0);

      // Low stock products (shopQuantity + warehouseQuantity < minStockLevel)
      const allProducts = await prisma.product.findMany({
        select: {
          id: true,
          shopQuantity: true,
          warehouseQuantity: true,
          shopMinStockLevel: true,
          warehouseMinStockLevel: true,
          minStockLevel: true,
        },
        orderBy: { createdAt: "desc" },
      });
      const lowStockProducts = allProducts.filter(
        (product) => {
          const shopThreshold = product.shopMinStockLevel ?? product.minStockLevel ?? 0;
          const warehouseThreshold = product.warehouseMinStockLevel ?? product.minStockLevel ?? 0;
          return (
            (shopThreshold > 0 && Number(product.shopQuantity || 0) <= Number(shopThreshold)) ||
            (warehouseThreshold > 0 && Number(product.warehouseQuantity || 0) <= Number(warehouseThreshold))
          );
        }
      );
      const lowStockCount = lowStockProducts.length;

      // Pending sales
      const pendingSales = await prisma.sale.findMany({
        where: {
          status: "pending",
        },
      });
      const pendingSalesAmount = pendingSales.reduce(
        (sum, sale) => sum + Number(sale.remainingBalance || 0),
        0
      );

      // Pending purchases
      const pendingPurchases = await prisma.purchase.findMany({
        where: {
          status: "pending",
        },
        orderBy: { createdAt: "desc" },
      });
      const pendingPurchasesAmount = pendingPurchases.reduce(
        (sum, purchase) => sum + Number(purchase.remainingBalance || 0),
        0
      );

      // Total products
      const totalProducts = await prisma.product.count();

      // Net profit
      const netProfit = totalSales - totalExpenses - totalPurchases;

      // Monthly sales for last 12 months
      const monthlySales = await this.getMonthlySales();

      // Recent sales (last 5, include all statuses)
      const recentSales = await prisma.sale.findMany({
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
        select: {
          id: true,
          billNumber: true,
          customerName: true,
          date: true,
          total: true,
          status: true,
          createdAt: true,
        },
      });

      const monthlyData = monthlySales || {
        categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
        data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        expenses: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      };

      return {
        metrics: {
          todaySales: todaySalesTotal || 0,
          todaySalesNonCancelled: todaySalesNonCancelled || 0,
          todayPurchasesNonCancelled: todayPurchasesNonCancelled || 0,
          totalSales: totalSales || 0,
          totalExpenses: totalExpenses || 0,
          totalPurchases: totalPurchases || 0,
          lowStockCount: lowStockCount || 0,
          pendingSalesCount: pendingSales.length || 0,
          pendingSalesAmount: pendingSalesAmount || 0,
          pendingPurchasesCount: pendingPurchases.length || 0,
          pendingPurchasesAmount: pendingPurchasesAmount || 0,
          netProfit: netProfit || 0,
          totalProducts: totalProducts || 0,
        },
        monthlySales: monthlyData,
        recentSales: (recentSales || []).map((sale) => ({
          id: sale.id || "",
          billNumber: sale.billNumber || "N/A",
          customerName: sale.customerName || "Walk-in",
          date: sale.date || sale.createdAt || new Date().toISOString(),
          total: Number(sale.total) || 0,
          status: sale.status || "completed",
        })),
      };
    } catch (error) {
      logger.error("Error getting dashboard stats:", error);
      throw error;
    }
  }

  private async getMonthlySales() {
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const currentDate = new Date();
    const monthlySalesData = new Array(12).fill(0);
    const monthlyExpensesData = new Array(12).fill(0);
    const monthlyPurchasesData = new Array(12).fill(0);

    // Get sales and expenses for the last 12 months
    for (let i = 0; i < 12; i++) {
      const monthStart = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - i,
        1
      );
      const monthEnd = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - i + 1,
        0,
        23,
        59,
        59,
        999
      );

      // Get sales for this month
      const monthSales = await prisma.sale.findMany({
        where: {
          date: {
            gte: monthStart,
            lte: monthEnd,
          },
          // include all statuses (completed/pending/cancelled) so chart is not empty
        },
        orderBy: { createdAt: "desc" },
      });

      const monthSalesTotal = monthSales.reduce(
        (sum, sale) => sum + Number(sale.total),
        0
      );
      monthlySalesData[11 - i] = monthSalesTotal;

      // Get expenses for this month
      const monthExpenses = await prisma.expense.findMany({
        where: {
          date: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const monthExpensesTotal = monthExpenses.reduce(
        (sum, expense) => sum + Number(expense.amount),
        0
      );
      monthlyExpensesData[11 - i] = monthExpensesTotal;

      // Get purchases for this month
      const monthPurchases = await prisma.purchase.findMany({
        where: {
          date: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        orderBy: { createdAt: "desc" },
      });
      const monthPurchasesTotal = monthPurchases.reduce(
        (sum, purchase) => sum + Number(purchase.total),
        0
      );
      monthlyPurchasesData[11 - i] = monthPurchasesTotal;
    }

    // Quarterly (last 4 quarters)
    const quarterlyCategories = ["Q1", "Q2", "Q3", "Q4"];
    const quarterlySales = [];
    const quarterlyExpenses = [];
    const quarterlyPurchases = [];
    for (let q = 0; q < 4; q++) {
      const startMonth = currentDate.getMonth() - q * 3 - 2;
      const quarterStart = new Date(currentDate.getFullYear(), startMonth, 1);
      const quarterEnd = new Date(currentDate.getFullYear(), startMonth + 3, 0, 23, 59, 59, 999);

      const qSales = await prisma.sale.findMany({
        where: {
          date: { gte: quarterStart, lte: quarterEnd },
        },
        orderBy: { createdAt: "desc" },
      });
      const qExpenses = await prisma.expense.findMany({
        where: {
          date: { gte: quarterStart, lte: quarterEnd },
        },
        orderBy: { createdAt: "desc" },
      });
      const qPurchases = await prisma.purchase.findMany({
        where: {
          date: { gte: quarterStart, lte: quarterEnd },
        },
        orderBy: { createdAt: "desc" },
      });

      quarterlySales.unshift(qSales.reduce((s, v) => s + Number(v.total), 0));
      quarterlyExpenses.unshift(qExpenses.reduce((s, v) => s + Number(v.amount), 0));
      quarterlyPurchases.unshift(qPurchases.reduce((s, v) => s + Number(v.total), 0));
    }

    // Annual (last 3 years)
    const annualCategories: string[] = [];
    const annualSales: number[] = [];
    const annualExpenses: number[] = [];
    const annualPurchases: number[] = [];
    for (let y = 0; y < 3; y++) {
      const year = currentDate.getFullYear() - (2 - y);
      const yearStart = new Date(year, 0, 1);
      const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

      const ySales = await prisma.sale.findMany({
        where: {
          date: { gte: yearStart, lte: yearEnd },
        },
        orderBy: { createdAt: "desc" },
      });
      const yExpenses = await prisma.expense.findMany({
        where: {
          date: { gte: yearStart, lte: yearEnd },
        },
        orderBy: { createdAt: "desc" },
      });
      const yPurchases = await prisma.purchase.findMany({
        where: {
          date: { gte: yearStart, lte: yearEnd },
        },
        orderBy: { createdAt: "desc" },
      });

      annualCategories.push(String(year));
      annualSales.push(ySales.reduce((s, v) => s + Number(v.total), 0));
      annualExpenses.push(yExpenses.reduce((s, v) => s + Number(v.amount), 0));
      annualPurchases.push(yPurchases.reduce((s, v) => s + Number(v.total), 0));
    }

    return {
      categories: months,
      sales: monthlySalesData,
      expenses: monthlyExpensesData,
      purchases: monthlyPurchasesData,
      quarterly: {
        categories: quarterlyCategories,
        sales: quarterlySales,
        expenses: quarterlyExpenses,
        purchases: quarterlyPurchases,
      },
      annual: {
        categories: annualCategories,
        sales: annualSales,
        expenses: annualExpenses,
        purchases: annualPurchases,
      },
    };
  }
}

export default new DashboardService();

