import { DollarLineIcon, BoxIconLine, FileIcon } from "../../icons";
import { formatPriceWithCurrencyComplete } from "../../utils/priceHelpers";
import { DashboardStats } from "../../types";



interface EcommerceMetricsProps {
  stats: DashboardStats | null;
  loading: boolean;
}

export default function EcommerceMetrics({ stats, loading }: EcommerceMetricsProps) {



  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 md:gap-6">
        <div className="rounded-xl sm:rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="animate-pulse">
            <div className="h-10 w-10 sm:h-12 sm:w-12 bg-gray-200 rounded-lg sm:rounded-xl dark:bg-gray-800"></div>
            <div className="mt-4 sm:mt-5 h-4 bg-gray-200 rounded w-20 dark:bg-gray-800"></div>
            <div className="mt-1 sm:mt-2 h-6 sm:h-8 bg-gray-200 rounded w-24 dark:bg-gray-800"></div>
          </div>
        </div>
        <div className="rounded-xl sm:rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="animate-pulse">
            <div className="h-10 w-10 sm:h-12 sm:w-12 bg-gray-200 rounded-lg sm:rounded-xl dark:bg-gray-800"></div>
            <div className="mt-4 sm:mt-5 h-4 bg-gray-200 rounded w-20 dark:bg-gray-800"></div>
            <div className="mt-1 sm:mt-2 h-6 sm:h-8 bg-gray-200 rounded w-24 dark:bg-gray-800"></div>
          </div>
        </div>
        <div className="rounded-xl sm:rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="animate-pulse">
            <div className="h-10 w-10 sm:h-12 sm:w-12 bg-gray-200 rounded-lg sm:rounded-xl dark:bg-gray-800"></div>
            <div className="mt-4 sm:mt-5 h-4 bg-gray-200 rounded w-20 dark:bg-gray-800"></div>
            <div className="mt-1 sm:mt-2 h-6 sm:h-8 bg-gray-200 rounded w-24 dark:bg-gray-800"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 md:gap-6">
        <div className="rounded-xl sm:rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">No data available</p>
        </div>
      </div>
    );
  }

  const { metrics } = stats || {};

  // Safe defaults for all metrics
  const safeMetrics = {
    todaySales: metrics?.todaySales ?? 0,
    todaySalesNonCancelled: metrics?.todaySalesNonCancelled ?? 0,
    todayPurchasesNonCancelled: metrics?.todayPurchasesNonCancelled ?? 0,
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

  const cards: Array<{
    title: string;
    value: number;
    icon: React.ReactElement;
    bg: string;
    suffix?: string;
  }> = [
      {
        title: "Total Products",
        value: safeMetrics.totalProducts,
        icon: <BoxIconLine className="text-indigo-600 size-6 dark:text-indigo-400" />,
        bg: "bg-indigo-100 dark:bg-indigo-500/10",
        suffix: " ",
      },
      {
        title: "Total Sales",
        value: safeMetrics.totalSales,
        icon: <DollarLineIcon className="text-blue-600 size-6 dark:text-blue-400" />,
        bg: "bg-blue-100 dark:bg-blue-500/10",
      },
      {
        title: "Total Purchases",
        value: safeMetrics.totalPurchases,
        icon: <BoxIconLine className="text-purple-600 size-6 dark:text-purple-400" />,
        bg: "bg-purple-100 dark:bg-purple-500/10",
      },
      {
        title: "Total Expenses",
        value: safeMetrics.totalExpenses,
        icon: <FileIcon className="text-red-600 size-6 dark:text-red-400" />,
        bg: "bg-red-100 dark:bg-red-500/10",
      },

      {
        title: "Today Sales Amount",
        value: safeMetrics.todaySalesNonCancelled,
        icon: <DollarLineIcon className="text-green-600 size-6 dark:text-green-400" />,
        bg: "bg-green-100 dark:bg-green-500/10",
      },
      {
        title: "Today Purchase Amount",
        value: safeMetrics.todayPurchasesNonCancelled,
        icon: <BoxIconLine className="text-orange-600 size-6 dark:text-orange-400" />,
        bg: "bg-orange-100 dark:bg-orange-500/10",
      },
    ];

  // Show all cards without permission checks
  const filteredCards = cards;


  return (
    <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 md:gap-6">
      {filteredCards.map((card, idx) => (
        <div
          key={idx}
          className="rounded-xl sm:rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6"
        >
          <div className={`flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl ${card.bg}`}>
            {card.icon}
          </div>
          <div className="flex items-end justify-between mt-4 sm:mt-5">
            <div className="w-full">
              <span className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{card.title}</span>
              <h4 className={`mt-1 sm:mt-2 font-bold text-base sm:text-lg lg:text-xl ${card.suffix ? 'text-gray-800 dark:text-white/90' : 'text-gray-800 dark:text-white/90 price-responsive'}`}>
                {card.suffix
                  ? `${card.value} ${card.suffix}`
                  : formatPriceWithCurrencyComplete(card.value || 0)}
              </h4>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
