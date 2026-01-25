import { useEffect, useState, useMemo } from "react";
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import api from "../../services/api";
import { formatPrice, formatPriceWithCurrency } from "../../utils/priceHelpers";

type TrendData = {
  categories: string[];
  sales: number[];
  expenses: number[];
  purchases: number[];
  quarterly?: {
    categories: string[];
    sales: number[];
    expenses: number[];
    purchases: number[];
  };
  annual?: {
    categories: string[];
    sales: number[];
    expenses: number[];
    purchases: number[];
  };
};

export default function StatisticsChart() {
  const [trendData, setTrendData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"monthly" | "quarterly" | "annual">("monthly");

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const stats = await api.getDashboardStats();
        const ms = stats?.monthlySales;

        const monthlySales = ms?.sales ?? ms?.data ?? new Array(12).fill(0);
        const monthlyExpenses = ms?.expenses ?? new Array(12).fill(0);
        const monthlyPurchases = ms?.purchases ?? new Array(12).fill(0);

        const quarterlySales = ms?.quarterly?.sales ?? ms?.quarterly?.data ?? new Array(4).fill(0);
        const quarterlyExpenses = ms?.quarterly?.expenses ?? new Array(4).fill(0);
        const quarterlyPurchases = ms?.quarterly?.purchases ?? new Array(4).fill(0);

        const annualSales = ms?.annual?.sales ?? ms?.annual?.data ?? [];
        const annualExpenses = ms?.annual?.expenses ?? [];
        const annualPurchases = ms?.annual?.purchases ?? [];

        setTrendData({
          categories: ms?.categories || ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
          sales: monthlySales,
          expenses: monthlyExpenses,
          purchases: monthlyPurchases,
          quarterly: ms?.quarterly
            ? {
                categories: ms.quarterly.categories || ["Q1", "Q2", "Q3", "Q4"],
                sales: quarterlySales,
                expenses: quarterlyExpenses,
                purchases: quarterlyPurchases,
              }
            : undefined,
          annual: ms?.annual
            ? {
                categories: ms.annual.categories || [],
                sales: annualSales,
                expenses: annualExpenses,
                purchases: annualPurchases,
              }
            : undefined,
        });
      } catch (error: any) {
        console.error("Error loading statistics:", error);
        setTrendData({
          categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
          sales: new Array(12).fill(0),
          expenses: new Array(12).fill(0),
          purchases: new Array(12).fill(0),
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const defaultCategories = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const normalize = (arr: number[] | undefined, len: number) => {
    const base = Array.isArray(arr) ? arr.slice(0, len) : [];
    while (base.length < len) base.push(0);
    return base;
  };

  const activeCategories =
    view === "quarterly"
      ? trendData?.quarterly?.categories || ["Q1", "Q2", "Q3", "Q4"]
      : view === "annual"
      ? trendData?.annual?.categories || []
      : trendData?.categories || defaultCategories;

  const activeSales =
    view === "quarterly"
      ? normalize(trendData?.quarterly?.sales, (trendData?.quarterly?.categories || ["Q1", "Q2", "Q3", "Q4"]).length)
      : view === "annual"
      ? normalize(trendData?.annual?.sales, (trendData?.annual?.categories || []).length || 12)
      : normalize(trendData?.sales, (trendData?.categories || defaultCategories).length);

  const activeExpenses =
    view === "quarterly"
      ? normalize(trendData?.quarterly?.expenses, (trendData?.quarterly?.categories || ["Q1", "Q2", "Q3", "Q4"]).length)
      : view === "annual"
      ? normalize(trendData?.annual?.expenses, (trendData?.annual?.categories || []).length || 12)
      : normalize(trendData?.expenses, (trendData?.categories || defaultCategories).length);

  const activePurchases =
    view === "quarterly"
      ? normalize(trendData?.quarterly?.purchases, (trendData?.quarterly?.categories || ["Q1", "Q2", "Q3", "Q4"]).length)
      : view === "annual"
      ? normalize(trendData?.annual?.purchases, (trendData?.annual?.categories || []).length || 12)
      : normalize(trendData?.purchases, (trendData?.categories || defaultCategories).length);

  const options: ApexOptions = useMemo(() => ({
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
    },
    colors: ["#10B981", "#EF4444", "#8b5cf6"], // Sales (green), Expenses (red), Purchases (purple)
    chart: {
      fontFamily: "Outfit, sans-serif",
      height: 310,
      type: "area",
      toolbar: {
        show: false,
      },
    },
    stroke: {
      curve: "smooth",
      width: [2, 2],
    },
    fill: {
      type: "gradient",
      gradient: {
        opacityFrom: 0.55,
        opacityTo: 0,
      },
    },
    markers: {
      size: 0,
      strokeColors: "#fff",
      strokeWidth: 2,
      hover: {
        size: 6,
      },
    },
    grid: {
      xaxis: {
        lines: {
          show: false,
        },
      },
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
    dataLabels: {
      enabled: false,
    },
    tooltip: {
      enabled: true,
      y: {
        formatter: (val: number) => formatPriceWithCurrency(val || 0),
      },
    },
    xaxis: {
      type: "category",
      categories: activeCategories,
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
      tooltip: {
        enabled: false,
      },
    },
    yaxis: {
      labels: {
        style: {
          fontSize: "12px",
          colors: ["#6B7280"],
        },
        formatter: (val: number) => `Rs. ${formatPrice(val || 0)}`,
      },
      title: {
        text: "",
        style: {
          fontSize: "0px",
        },
      },
    },

  }), [activeCategories]);

  const series = useMemo(() => [
    {
      name: "Sales",
      data: activeSales,
    },
    {
      name: "Expenses",
      data: activeExpenses,
    },
    {
      name: "Purchases",
      data: activePurchases,
    },
  ], [activeSales, activeExpenses, activePurchases]);

  if (loading) {
    return (
      <div className="rounded-xl sm:rounded-2xl border border-gray-200 bg-white px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4 md:px-5 md:pb-5 md:pt-5 dark:border-gray-800 dark:bg-white/[0.03] md:px-6 md:pt-6">
        <div className="animate-pulse">
          <div className="h-5 sm:h-6 bg-gray-200 rounded w-32 dark:bg-gray-800 mb-4"></div>
          <div className="h-[250px] sm:h-[310px] bg-gray-200 rounded dark:bg-gray-800"></div>
        </div>
      </div>
    );
  }

  if (!trendData) {
    return (
      <div className="rounded-xl sm:rounded-2xl border border-gray-200 bg-white px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4 md:px-5 md:pb-5 md:pt-5 dark:border-gray-800 dark:bg-white/[0.03] md:px-6 md:pt-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
          Statistics
        </h3>
        <div className="py-8 text-center">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Data not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl sm:rounded-2xl border border-gray-200 bg-white px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4 md:px-5 md:pb-5 md:pt-5 dark:border-gray-800 dark:bg-white/[0.03] md:px-6 md:pt-6">
      <div className="flex flex-col gap-4 sm:gap-5 mb-4 sm:mb-6 sm:flex-row sm:justify-between">
        <div className="w-full">
          <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white/90">
            Sales vs Expenses vs Purchases
          </h3>
          <p className="mt-1 text-xs sm:text-theme-sm text-gray-500 dark:text-gray-400">
            Monthly / Quarterly / Annual comparison
          </p>
        </div>
        <div className="flex items-start w-full gap-2 sm:gap-3 sm:justify-end">
          <div className="flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900 w-full sm:w-auto">
            <button
              onClick={() => setView("monthly")}
              className={`px-2 sm:px-3 py-1.5 sm:py-2 font-medium w-full rounded-md text-xs sm:text-theme-sm ${
                view === "monthly"
                  ? "shadow-theme-xs text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setView("quarterly")}
              className={`px-2 sm:px-3 py-1.5 sm:py-2 font-medium w-full rounded-md text-xs sm:text-theme-sm ${
                view === "quarterly"
                  ? "shadow-theme-xs text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              Quarterly
            </button>
            <button
              onClick={() => setView("annual")}
              className={`px-2 sm:px-3 py-1.5 sm:py-2 font-medium w-full rounded-md text-xs sm:text-theme-sm ${
                view === "annual"
                  ? "shadow-theme-xs text-gray-900 dark:text-white bg-white dark:bg-gray-800"
                  : "text-gray-500 dark:text-gray-400"
              }`}
            >
              Annually
            </button>
          </div>
        </div>
      </div>

      <div className="table-container custom-scrollbar">
        <div className="min-w-[800px] sm:min-w-[1000px] xl:min-w-full">
          <Chart options={options} series={series} type="area" height={310} />
        </div>
      </div>
    </div>
  );
}
