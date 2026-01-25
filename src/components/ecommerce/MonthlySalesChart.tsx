import { useEffect, useState, useMemo } from "react";
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { MoreDotIcon } from "../../icons";
import api from "../../services/api";
import { formatPriceWithCurrencyComplete } from "../../utils/priceHelpers";

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

export default function MonthlySalesChart() {
  const [monthlyData, setMonthlyData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
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

        setMonthlyData({
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
        console.error("Error loading monthly sales:", error);
        setMonthlyData({
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
      ? monthlyData?.quarterly?.categories || ["Q1", "Q2", "Q3", "Q4"]
      : view === "annual"
      ? monthlyData?.annual?.categories || []
      : monthlyData?.categories || defaultCategories;

  const activeSales =
    view === "quarterly"
      ? normalize(monthlyData?.quarterly?.sales, (monthlyData?.quarterly?.categories || ["Q1", "Q2", "Q3", "Q4"]).length)
      : view === "annual"
      ? normalize(monthlyData?.annual?.sales, (monthlyData?.annual?.categories || []).length || 12)
      : normalize(monthlyData?.sales, (monthlyData?.categories || defaultCategories).length);

  const activeExpenses =
    view === "quarterly"
      ? normalize(monthlyData?.quarterly?.expenses, (monthlyData?.quarterly?.categories || ["Q1", "Q2", "Q3", "Q4"]).length)
      : view === "annual"
      ? normalize(monthlyData?.annual?.expenses, (monthlyData?.annual?.categories || []).length || 12)
      : normalize(monthlyData?.expenses, (monthlyData?.categories || defaultCategories).length);

  const activePurchases =
    view === "quarterly"
      ? normalize(monthlyData?.quarterly?.purchases, (monthlyData?.quarterly?.categories || ["Q1", "Q2", "Q3", "Q4"]).length)
      : view === "annual"
      ? normalize(monthlyData?.annual?.purchases, (monthlyData?.annual?.categories || []).length || 12)
      : normalize(monthlyData?.purchases, (monthlyData?.categories || defaultCategories).length);

  const options: ApexOptions = useMemo(() => ({
    colors: ["#10B981", "#EF4444", "#8b5cf6"], // Sales (green), Expenses (red), Purchases (purple)
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "bar",
      height: 220,
      toolbar: {
        show: false,
      },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "39%",
        borderRadius: 5,
        borderRadiusApplication: "end",
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      show: true,
      width: 3,
      colors: ["transparent"],
    },
    xaxis: {
      categories: activeCategories,
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
      fontFamily: "Outfit",
    },
    yaxis: {
      title: {
        text: undefined,
      },
      labels: {
        formatter: (val: number) => {
          // Format for y-axis: show abbreviated version for better readability
          // But use complete format for values < 1M
          if (val >= 1_000_000) {
            const value = val / 1_000_000;
            if (value >= 100) {
              return `${value.toFixed(0)}M`;
            } else if (value >= 10) {
              return `${value.toFixed(1)}M`;
            } else {
              return `${value.toFixed(2)}M`;
            }
          } else {
            // For values < 1M, show complete format with commas
            return formatPriceWithCurrencyComplete(val).replace('Rs. ', '');
          }
        },
      },
    },
    grid: {
      yaxis: {
        lines: {
          show: true,
        },
      },
    },
    fill: {
      opacity: 1,
    },
    tooltip: {
      x: {
        show: false,
      },
      y: {
        formatter: (val: number) => formatPriceWithCurrencyComplete(val || 0),
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

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  if (loading) {
    return (
      <div className="overflow-hidden rounded-xl sm:rounded-2xl border border-gray-200 bg-white px-3 pt-3 sm:px-4 sm:pt-4 md:px-5 md:pt-5 dark:border-gray-800 dark:bg-white/[0.03] md:px-6 md:pt-6">
        <div className="animate-pulse">
          <div className="h-5 sm:h-6 bg-gray-200 rounded w-32 dark:bg-gray-800 mb-4"></div>
          <div className="h-[150px] sm:h-[180px] bg-gray-200 rounded dark:bg-gray-800"></div>
        </div>
      </div>
    );
  }

  if (!monthlyData || !activeCategories || activeCategories.length === 0) {
    return (
      <div className="overflow-hidden rounded-xl sm:rounded-2xl border border-gray-200 bg-white px-3 pt-3 sm:px-4 sm:pt-4 md:px-5 md:pt-5 dark:border-gray-800 dark:bg-white/[0.03] md:px-6 md:pt-6">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
          Sales vs Expenses vs Purchases
        </h3>
        <div className="py-8 text-center">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Data not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl sm:rounded-2xl border border-gray-200 bg-white px-3 pt-3 sm:px-4 sm:pt-4 md:px-5 md:pt-5 dark:border-gray-800 dark:bg-white/[0.03] md:px-6 md:pt-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 mb-4">
        <h3 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white/90">
          Sales vs Expenses vs Purchases
        </h3>
        <div className="relative inline-block">
          <button className="dropdown-toggle" onClick={toggleDropdown}>
            <MoreDotIcon className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 size-5 sm:size-6" />
          </button>
          <Dropdown
            isOpen={isOpen}
            onClose={closeDropdown}
            className="w-40 p-2"
          >
            <DropdownItem
              onItemClick={() => {
                setView("monthly");
                closeDropdown();
              }}
              className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              Monthly
            </DropdownItem>
            <DropdownItem
              onItemClick={() => {
                setView("quarterly");
                closeDropdown();
              }}
              className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              Quarterly
            </DropdownItem>
            <DropdownItem
              onItemClick={() => {
                setView("annual");
                closeDropdown();
              }}
              className="flex w-full font-normal text-left text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              Annual
            </DropdownItem>
          </Dropdown>
        </div>
      </div>

      <div className="table-container custom-scrollbar">
        <div className="min-w-[600px] sm:min-w-[650px] xl:min-w-full">
          {monthlyData && (
            <Chart options={options} series={series} type="bar" height={220} />
          )}
        </div>
      </div>
    </div>
  );
}
