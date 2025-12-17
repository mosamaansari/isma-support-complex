import { useEffect, useMemo } from "react";
import { useData } from "../../context/DataContext";
import { DollarLineIcon, BoxIconLine, FileIcon, AlertIcon } from "../../icons";
import Badge from "../ui/badge/Badge";
import { Link } from "react-router";

export default function DashboardMetrics() {
  const { sales, expenses, purchases, products, getLowStockProducts } = useData();

  // Calculate today's date
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date.toISOString();
  }, []);

  // Calculate metrics
  const metrics = useMemo(() => {
    // Today's sales
    const todaySales = sales.filter((sale) => {
      const saleDate = new Date(sale.date || sale.createdAt);
      saleDate.setHours(0, 0, 0, 0);
      return saleDate.toISOString() === today && sale.status === "completed";
    });
    const todaySalesTotal = todaySales.reduce((sum, sale) => sum + (sale.total || 0), 0);

    // Total sales (all time)
    const totalSales = sales
      .filter((s) => s.status === "completed")
      .reduce((sum, sale) => sum + (sale.total || 0), 0);

    // Total expenses
    const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    // Total purchases
    const totalPurchases = purchases.reduce((sum, pur) => sum + (pur.total || 0), 0);

    // Low stock products
    const lowStockProducts = getLowStockProducts();

    // Pending payments (sales)
    const pendingSales = sales.filter((s) => s.status === "pending");
    const pendingSalesAmount = pendingSales.reduce(
      (sum, sale) => sum + (sale.remainingBalance || 0),
      0
    );

    // Pending payments (purchases)
    const pendingPurchases = purchases.filter((p) => p.status === "pending");
    const pendingPurchasesAmount = pendingPurchases.reduce(
      (sum, pur) => sum + (pur.remainingBalance || 0),
      0
    );

    // Net profit (Sales - Expenses - Purchases)
    const netProfit = totalSales - totalExpenses - totalPurchases;

    return {
      todaySales: todaySalesTotal,
      totalSales,
      totalExpenses,
      totalPurchases,
      lowStockCount: lowStockProducts.length,
      pendingSalesCount: pendingSales.length,
      pendingSalesAmount,
      pendingPurchasesCount: pendingPurchases.length,
      pendingPurchasesAmount,
      netProfit,
    };
  }, [sales, expenses, purchases, products, getLowStockProducts, today]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-6">
      {/* Today's Sales */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-xl dark:bg-green-500/10">
          <DollarLineIcon className="text-green-600 size-6 dark:text-green-400" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Today's Sales</span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              Rs. {metrics.todaySales.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </h4>
          </div>
        </div>
      </div>

      {/* Total Sales */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl dark:bg-blue-500/10">
          <DollarLineIcon className="text-blue-600 size-6 dark:text-blue-400" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Total Sales</span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              Rs. {metrics.totalSales.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </h4>
          </div>
        </div>
      </div>

      {/* Total Expenses */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-xl dark:bg-red-500/10">
          <FileIcon className="text-red-600 size-6 dark:text-red-400" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Total Expenses</span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              Rs. {metrics.totalExpenses.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </h4>
          </div>
        </div>
      </div>

      {/* Low Stock Products */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-orange-100 rounded-xl dark:bg-orange-500/10">
          <AlertIcon className="text-orange-600 size-6 dark:text-orange-400" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Low Stock Products</span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {metrics.lowStockCount}
            </h4>
            {metrics.lowStockCount > 0 && (
              <Link
                to="/inventory/products"
                className="mt-1 text-xs text-orange-600 hover:underline dark:text-orange-400"
              >
                View Products
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Pending Sales Payments */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-yellow-100 rounded-xl dark:bg-yellow-500/10">
          <DollarLineIcon className="text-yellow-600 size-6 dark:text-yellow-400" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Pending Sales</span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              Rs. {metrics.pendingSalesAmount.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </h4>
            {metrics.pendingSalesCount > 0 && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {metrics.pendingSalesCount} {metrics.pendingSalesCount === 1 ? "sale" : "sales"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Pending Purchase Payments */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-purple-100 rounded-xl dark:bg-purple-500/10">
          <BoxIconLine className="text-purple-600 size-6 dark:text-purple-400" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Pending Purchases</span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              Rs. {metrics.pendingPurchasesAmount.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </h4>
            {metrics.pendingPurchasesCount > 0 && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {metrics.pendingPurchasesCount}{" "}
                {metrics.pendingPurchasesCount === 1 ? "purchase" : "purchases"}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Net Profit */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-emerald-100 rounded-xl dark:bg-emerald-500/10">
          <DollarLineIcon className="text-emerald-600 size-6 dark:text-emerald-400" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Net Profit</span>
            <h4
              className={`mt-2 font-bold text-title-sm ${
                metrics.netProfit >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              Rs. {metrics.netProfit.toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </h4>
          </div>
        </div>
      </div>

      {/* Total Products */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-xl dark:bg-indigo-500/10">
          <BoxIconLine className="text-indigo-600 size-6 dark:text-indigo-400" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Total Products</span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {products.length}
            </h4>
          </div>
        </div>
      </div>
    </div>
  );
}






