import { useEffect, useState, useMemo } from "react";
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import ChartTab from "../common/ChartTab";
import api from "../../services/api";

export default function StatisticsChart() {
  const [monthlyData, setMonthlyData] = useState<{
    sales: number[];
    expenses: number[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const stats = await api.getDashboardStats();
        
        // Get monthly sales and expenses from backend
        const monthlySales = stats?.monthlySales?.data || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        const monthlyExpenses = stats?.monthlySales?.expenses || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
        
        setMonthlyData({
          sales: monthlySales,
          expenses: monthlyExpenses,
        });
      } catch (error: any) {
        console.error("Error loading statistics:", error);
        setMonthlyData({
          sales: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
          expenses: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        });
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const defaultCategories = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const options: ApexOptions = useMemo(() => ({
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "left",
    },
    colors: ["#465FFF", "#EF4444"], // Sales (blue) and Expenses (red)
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
        formatter: (val: number) => `Rs. ${(val || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}`,
      },
    },
    xaxis: {
      type: "category",
      categories: monthlyData?.sales ? defaultCategories : defaultCategories,
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
        formatter: (val: number) => `Rs. ${(val || 0).toLocaleString("en-PK", { maximumFractionDigits: 0 })}`,
      },
      title: {
        text: "",
        style: {
          fontSize: "0px",
        },
      },
    },
  }), [monthlyData]);

  const series = useMemo(() => [
    {
      name: "Sales",
      data: monthlyData?.sales || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
    {
      name: "Expenses",
      data: monthlyData?.expenses || [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    },
  ], [monthlyData]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-32 dark:bg-gray-800 mb-4"></div>
          <div className="h-[310px] bg-gray-200 rounded dark:bg-gray-800"></div>
        </div>
      </div>
    );
  }

  if (!monthlyData) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
          Statistics
        </h3>
        <div className="py-8 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">Data not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-5 pb-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      <div className="flex flex-col gap-5 mb-6 sm:flex-row sm:justify-between">
        <div className="w-full">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Sales vs Expenses
          </h3>
          <p className="mt-1 text-gray-500 text-theme-sm dark:text-gray-400">
            Monthly comparison of sales and expenses
          </p>
        </div>
        <div className="flex items-start w-full gap-3 sm:justify-end">
          <ChartTab />
        </div>
      </div>

      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <div className="min-w-[1000px] xl:min-w-full">
          <Chart options={options} series={series} type="area" height={310} />
        </div>
      </div>
    </div>
  );
}
