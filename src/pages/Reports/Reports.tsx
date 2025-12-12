import { useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Button from "../../components/ui/button/Button";
import { DownloadIcon } from "../../icons";

export default function Reports() {
  const { getSalesByDateRange, getExpensesByDateRange } =
    useData();
  const [reportType, setReportType] = useState<
    "daily" | "weekly" | "monthly" | "custom"
  >("daily");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const getDateRange = () => {
    const today = new Date();
    let start: Date, end: Date;

    switch (reportType) {
      case "daily":
        start = new Date(today);
        end = new Date(today);
        break;
      case "weekly":
        start = new Date(today);
        start.setDate(today.getDate() - 7);
        end = new Date(today);
        break;
      case "monthly":
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case "custom":
        if (!startDate || !endDate) return null;
        start = new Date(startDate);
        end = new Date(endDate);
        break;
    }

    return {
      start: start.toISOString().split("T")[0],
      end: end.toISOString().split("T")[0],
    };
  };

  const dateRange = getDateRange();
  const filteredSales = dateRange
    ? getSalesByDateRange(dateRange.start, dateRange.end)
    : [];
  const filteredExpenses = dateRange
    ? getExpensesByDateRange(dateRange.start, dateRange.end)
    : [];

  const totalSales = filteredSales.reduce((sum, s) => sum + s.total, 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const profit = totalSales - totalExpenses;

  const exportToCSV = () => {
    if (!dateRange) return;

    const csvRows = [
      ["Report Type", reportType],
      ["Date Range", `${dateRange.start} to ${dateRange.end}`],
      [],
      ["Sales Report"],
      ["Bill Number", "Date", "Customer", "Total"],
      ...filteredSales.map((s) => [
        s.billNumber,
        new Date(s.createdAt).toLocaleDateString(),
        s.customerName || "Walk-in",
        s.total.toFixed(2),
      ]),
      [],
      ["Total Sales", totalSales.toFixed(2)],
      [],
      ["Expenses Report"],
      ["Date", "Category", "Description", "Amount"],
      ...filteredExpenses.map((e) => [
        new Date(e.date).toLocaleDateString(),
        e.category,
        e.description,
        e.amount.toFixed(2),
      ]),
      [],
      ["Total Expenses", totalExpenses.toFixed(2)],
      [],
      ["Profit/Loss", profit.toFixed(2)],
    ];

    const csvContent =
      "data:text/csv;charset=utf-8," +
      csvRows.map((row) => row.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `report_${dateRange.start}_${dateRange.end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <PageMeta
        title="Reports & Analysis | Isma Sports Complex"
        description="View sales, expenses and profit reports"
      />
      <div className="mb-6">
        <h1 className="mb-4 text-2xl font-bold text-gray-800 dark:text-white">
          Reports & Analysis
        </h1>

        <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2">
          <div>
            <Label>Report Type</Label>
            <select
              value={reportType}
              onChange={(e) =>
                setReportType(
                  e.target.value as "daily" | "weekly" | "monthly" | "custom"
                )
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
          {reportType === "custom" && (
            <>
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {dateRange && (
          <>
            <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-4">
              <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Total Sales
                </p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  Rs. {totalSales.toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Total Expenses
                </p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  Rs. {totalExpenses.toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Profit/Loss
                </p>
                <p
                  className={`text-2xl font-bold ${
                    profit >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  Rs. {profit.toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Total Bills
                </p>
                <p className="text-2xl font-bold text-gray-800 dark:text-white">
                  {filteredSales.length}
                </p>
              </div>
            </div>

            <div className="mb-6">
              <Button onClick={exportToCSV} size="sm">
                <DownloadIcon className="w-4 h-4 mr-2" />
                Export to CSV
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
                  Sales Report
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          Bill #
                        </th>
                        <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          Date
                        </th>
                        <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          Customer
                        </th>
                        <th className="p-2 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSales.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-gray-500">
                            No sales found
                          </td>
                        </tr>
                      ) : (
                        filteredSales.map((sale) => (
                          <tr
                            key={sale.id}
                            className="border-b border-gray-100 dark:border-gray-700"
                          >
                            <td className="p-2 text-gray-700 dark:text-gray-300">
                              {sale.billNumber}
                            </td>
                            <td className="p-2 text-gray-700 dark:text-gray-300">
                              {new Date(sale.createdAt).toLocaleDateString()}
                            </td>
                            <td className="p-2 text-gray-700 dark:text-gray-300">
                              {sale.customerName || "Walk-in"}
                            </td>
                            <td className="p-2 text-right font-semibold text-gray-800 dark:text-white">
                              Rs. {sale.total.toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
                  Expenses Report
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          Date
                        </th>
                        <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          Category
                        </th>
                        <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          Description
                        </th>
                        <th className="p-2 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-4 text-center text-gray-500">
                            No expenses found
                          </td>
                        </tr>
                      ) : (
                        filteredExpenses.map((expense) => (
                          <tr
                            key={expense.id}
                            className="border-b border-gray-100 dark:border-gray-700"
                          >
                            <td className="p-2 text-gray-700 dark:text-gray-300">
                              {new Date(expense.date).toLocaleDateString()}
                            </td>
                            <td className="p-2 text-gray-700 dark:text-gray-300 capitalize">
                              {expense.category}
                            </td>
                            <td className="p-2 text-gray-700 dark:text-gray-300">
                              {expense.description}
                            </td>
                            <td className="p-2 text-right font-semibold text-gray-800 dark:text-white">
                              Rs. {expense.amount.toFixed(2)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

