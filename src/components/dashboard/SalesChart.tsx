import { useMemo } from "react";
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import { useData } from "../../context/DataContext";

export default function SalesChart() {
  const { sales } = useData();

  // Get last 12 months of sales data
  const chartData = useMemo(() => {
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
    const monthlySales = new Array(12).fill(0);

    sales
      .filter((s) => s.status === "completed")
      .forEach((sale) => {
        const saleDate = new Date(sale.date || sale.createdAt);
        const monthIndex = saleDate.getMonth();
        const monthDiff = currentDate.getMonth() - monthIndex;
        const yearDiff = currentDate.getFullYear() - saleDate.getFullYear();

        // Calculate which month in the last 12 months this sale belongs to
        let monthsAgo = monthDiff + yearDiff * 12;
        if (monthsAgo < 12) {
          monthlySales[11 - monthsAgo] += sale.total || 0;
        }
      });

    return {
      categories: months,
      data: monthlySales,
    };
  }, [sales]);

  const options: ApexOptions = {
    colors: ["#465fff"],
    chart: {
      fontFamily: "Outfit, sans-serif",
      type: "bar",
      height: 300,
      toolbar: {
        show: false,
      },
    },
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "50%",
        borderRadius: 5,
        borderRadiusApplication: "end",
      },
    },
    dataLabels: {
      enabled: false,
    },
    stroke: {
      show: true,
      width: 2,
      colors: ["transparent"],
    },
    xaxis: {
      categories: chartData.categories,
      axisBorder: {
        show: false,
      },
      axisTicks: {
        show: false,
      },
    },
    legend: {
      show: false,
    },
    yaxis: {
      title: {
        text: "Amount (Rs.)",
      },
      labels: {
        formatter: (val: number) => {
          return `Rs. ${val.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
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
      y: {
        formatter: (val: number) => {
          return `Rs. ${val.toLocaleString("en-PK", { minimumFractionDigits: 2 })}`;
        },
      },
    },
  };

  const series = [
    {
      name: "Sales",
      data: chartData.data,
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-5 pt-5 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Monthly Sales Overview
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Sales performance for the last 12 months
          </p>
        </div>
      </div>

      <div className="max-w-full overflow-x-auto custom-scrollbar">
        <div className="-ml-5 min-w-[650px] xl:min-w-full pl-2">
          <Chart options={options} series={series} type="bar" height={300} />
        </div>
      </div>
    </div>
  );
}











