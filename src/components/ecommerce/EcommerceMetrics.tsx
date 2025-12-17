import { useEffect, useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BoxIconLine,
  GroupIcon,
  DollarLineIcon,
  FileIcon,
} from "../../icons";
import Badge from "../ui/badge/Badge";
import api from "../../services/api";

interface DashboardStats {
  metrics: {
    todaySales: number;
    totalSales: number;
    totalExpenses: number;
    totalPurchases: number;
    lowStockCount: number;
    pendingSalesCount: number;
    pendingSalesAmount: number;
    pendingPurchasesCount: number;
    pendingPurchasesAmount: number;
    netProfit: number;
    totalProducts: number;
  };
}

export default function EcommerceMetrics() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.getDashboardStats();
        setStats(data);
      } catch (error: any) {
        console.error("Error loading dashboard stats:", error);
        setError(error?.response?.data?.error || "Failed to load dashboard stats");
        // Set default stats on error
        setStats({
          metrics: {
            todaySales: 0,
            totalSales: 0,
            totalExpenses: 0,
            totalPurchases: 0,
            lowStockCount: 0,
            pendingSalesCount: 0,
            pendingSalesAmount: 0,
            pendingPurchasesCount: 0,
            pendingPurchasesAmount: 0,
            netProfit: 0,
            totalProducts: 0,
          },
        });
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="animate-pulse">
            <div className="h-12 w-12 bg-gray-200 rounded-xl dark:bg-gray-800"></div>
            <div className="mt-5 h-4 bg-gray-200 rounded w-20 dark:bg-gray-800"></div>
            <div className="mt-2 h-8 bg-gray-200 rounded w-24 dark:bg-gray-800"></div>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="animate-pulse">
            <div className="h-12 w-12 bg-gray-200 rounded-xl dark:bg-gray-800"></div>
            <div className="mt-5 h-4 bg-gray-200 rounded w-20 dark:bg-gray-800"></div>
            <div className="mt-2 h-8 bg-gray-200 rounded w-24 dark:bg-gray-800"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <p className="text-sm text-gray-500 dark:text-gray-400">No data available</p>
        </div>
      </div>
    );
  }

  const { metrics } = stats || {};

  // Safe defaults for all metrics
  const safeMetrics = {
    todaySales: metrics?.todaySales ?? 0,
    totalSales: metrics?.totalSales ?? 0,
    totalExpenses: metrics?.totalExpenses ?? 0,
    totalPurchases: metrics?.totalPurchases ?? 0,
    lowStockCount: metrics?.lowStockCount ?? 0,
    pendingSalesCount: metrics?.pendingSalesCount ?? 0,
    pendingSalesAmount: metrics?.pendingSalesAmount ?? 0,
    pendingPurchasesCount: metrics?.pendingPurchasesCount ?? 0,
    pendingPurchasesAmount: metrics?.pendingPurchasesAmount ?? 0,
    netProfit: metrics?.netProfit ?? 0,
    totalProducts: metrics?.totalProducts ?? 0,
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
      {/* Today's Sales */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
        <div className="flex items-center justify-center w-12 h-12 bg-green-100 rounded-xl dark:bg-green-500/10">
          <DollarLineIcon className="text-green-600 size-6 dark:text-green-400" />
        </div>
        <div className="flex items-end justify-between mt-5">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Today's Sales
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              Rs. {(safeMetrics.todaySales || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
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
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Total Sales
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              Rs. {(safeMetrics.totalSales || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
            </h4>
          </div>
        </div>
      </div>
    </div>
  );
}
