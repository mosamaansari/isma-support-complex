import prisma from "../config/database";
import logger from "../utils/logger";

class DashboardService {
  async getDashboardStats() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
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
      });

      // Calculate today's sales based on:
      // 1. Sales created/completed today (count full sale total)
      // 2. Payments made today to existing sales (count payment amounts only)
      let todaySalesTotal = 0;

      allSales.forEach((sale) => {
        const saleDate = sale.date ? new Date(sale.date) : new Date(sale.createdAt);
        saleDate.setHours(0, 0, 0, 0);
        const saleCreatedToday = saleDate.getTime() === today.getTime();
        const isCompletedToday = saleCreatedToday && sale.status === "completed";
        
        // If sale was created and completed today, count the full sale total
        if (isCompletedToday) {
          todaySalesTotal += Number(sale.total || 0);
          return; // Skip payment check to avoid double counting
        }

        // Check payments made today for sales not created today
        const payments = (sale.payments as Array<{
          type: string;
          amount: number;
          date?: string;
        }>) || [];
        
        payments.forEach((payment) => {
          if (payment.date) {
            const paymentDate = new Date(payment.date);
            paymentDate.setHours(0, 0, 0, 0);
            if (paymentDate.getTime() === today.getTime()) {
              // Count payment amount for sales not created today
              todaySalesTotal += Number(payment.amount || 0);
            }
          } else if (saleCreatedToday && !isCompletedToday) {
            // If sale created today but not completed, count payments without date
            todaySalesTotal += Number(payment.amount || 0);
          }
        });
      });

      // Total sales (all time)
      const totalSalesResult = await prisma.sale.aggregate({
        where: {
          status: "completed",
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

      // Total purchases
      const totalPurchasesResult = await prisma.purchase.aggregate({
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

      // Recent sales (last 5)
      const recentSales = await prisma.sale.findMany({
        where: {
          status: "completed",
        },
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
          status: "completed",
        },
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
      });

      const monthExpensesTotal = monthExpenses.reduce(
        (sum, expense) => sum + Number(expense.amount),
        0
      );
      monthlyExpensesData[11 - i] = monthExpensesTotal;
    }

    return {
      categories: months,
      data: monthlySalesData,
      expenses: monthlyExpensesData,
    };
  }
}

export default new DashboardService();

