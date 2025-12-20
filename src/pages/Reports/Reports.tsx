import { useState, useRef, useEffect } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import { useAlert } from "../../context/AlertContext";
import DatePicker from "../../components/form/DatePicker";
import Label from "../../components/form/Label";
import Button from "../../components/ui/button/Button";
import { DownloadIcon } from "../../icons";
import api from "../../services/api";
import { DailyReport, DateRangeReport } from "../../types";
import { getDateRangeFromType } from "../../utils/dateHelpers";

export default function Reports() {
  const { getSalesByDateRange, getExpensesByDateRange, currentUser } = useData();
  const { showError } = useAlert();
  const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly" | "custom">("daily");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const printRef = useRef<HTMLDivElement>(null);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [dateRangeReport, setDateRangeReport] = useState<DateRangeReport | null>(null);
  const [loading, setLoading] = useState(false);

  const getDateRange = () => {
    return getDateRangeFromType(reportType, startDate, endDate);
  };

  // Load reports from backend API
  useEffect(() => {
    const loadReport = async () => {
      const dateRange = getDateRange();
      if (!dateRange || !currentUser) return;

      setLoading(true);
      try {
        if (reportType === "daily") {
          const report = await api.getDailyReport(dateRange.start);
          setDailyReport(report);
          setDateRangeReport(null);
        } else {
          const report = await api.getDateRangeReport(dateRange.start, dateRange.end);
          setDateRangeReport(report);
          setDailyReport(null);
        }
      } catch (error: any) {
        console.error("Error loading report:", error);
        showError(error.response?.data?.error || "Failed to load report");
        setDailyReport(null);
        setDateRangeReport(null);
      } finally {
        setLoading(false);
      }
    };

    loadReport();
  }, [reportType, startDate, endDate, currentUser]);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Please login to continue</p>
        </div>
      </div>
    );
  }

  const dateRange = getDateRange();
  
  // Use backend report data if available, otherwise fallback to frontend data
  const isUsingBackendData = reportType === "daily" ? !!dailyReport : !!dateRangeReport;
  
  let filteredSales: any[] = [];
  let filteredExpenses: any[] = [];
  let filteredPurchases: any[] = [];
  let totalSales = 0;
  let totalExpenses = 0;
  let totalPurchases = 0;
  let openingBalance = 0;
  let profit = 0;
  let closingBalance = 0;

  if (isUsingBackendData && reportType === "daily" && dailyReport) {
    filteredSales = dailyReport.sales?.items || [];
    filteredExpenses = dailyReport.expenses?.items || [];
    filteredPurchases = dailyReport.purchases?.items || [];
    totalSales = dailyReport.sales?.total || 0;
    totalExpenses = dailyReport.expenses?.total || 0;
    totalPurchases = dailyReport.purchases?.total || 0;
    openingBalance = dailyReport.openingBalance?.total || 0;
    profit = totalSales - totalExpenses - totalPurchases;
    closingBalance = dailyReport.closingBalance?.total || 0;
  } else if (isUsingBackendData && dateRangeReport) {
    filteredSales = dateRangeReport.sales || [];
    filteredExpenses = dateRangeReport.expenses || [];
    filteredPurchases = dateRangeReport.purchases || [];
    totalSales = dateRangeReport.summary?.sales?.total || 0;
    totalExpenses = dateRangeReport.summary?.expenses?.total || 0;
    totalPurchases = dateRangeReport.summary?.purchases?.total || 0;
    openingBalance = dateRangeReport.summary?.openingBalance?.total || 0;
    profit = totalSales - totalExpenses - totalPurchases;
    closingBalance = dateRangeReport.summary?.closingBalance?.total || 0;
  } else if (dateRange) {
    // Fallback to frontend data
    filteredSales = getSalesByDateRange(dateRange.start, dateRange.end) || [];
    filteredExpenses = getExpensesByDateRange(dateRange.start, dateRange.end) || [];
    totalSales = filteredSales.reduce((sum, s) => sum + Number(s?.total || 0), 0);
    totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e?.amount || 0), 0);
    profit = totalSales - totalExpenses;
    closingBalance = profit;
  }

  // Group sales by customer for combined totals
  const customerSalesMap = new Map<string, { customerName: string; total: number; bills: string[]; count: number }>();
  filteredSales.forEach((sale) => {
    if (!sale || !sale.id) return;
    const customerName = sale.customerName || "Walk-in";
    const saleTotal = Number(sale.total || 0);
    
    if (customerSalesMap.has(customerName)) {
      const existing = customerSalesMap.get(customerName)!;
      existing.total += saleTotal;
      existing.count += 1;
      if (sale.billNumber) {
        existing.bills.push(sale.billNumber);
      }
    } else {
      customerSalesMap.set(customerName, {
        customerName,
        total: saleTotal,
        bills: sale.billNumber ? [sale.billNumber] : [],
        count: 1,
      });
    }
  });

  // Convert to array and sort by total (descending)
  const customerTotals = Array.from(customerSalesMap.values())
    .filter((item) => item.count > 1) // Only show combined rows if customer has multiple sales
    .sort((a, b) => b.total - a.total);

  const exportToExcel = async () => {
    if (!dateRange) return;

    try {
      const reportData = {
        summary: {
          "Opening Balance": openingBalance > 0 ? openingBalance.toFixed(2) : "0.00",
          "Total Sales": totalSales.toFixed(2),
          "Total Purchases": totalPurchases > 0 ? totalPurchases.toFixed(2) : "0.00",
          "Total Expenses": totalExpenses.toFixed(2),
          "Net Profit/Loss": profit.toFixed(2),
          "Closing Balance": isUsingBackendData && closingBalance ? closingBalance.toFixed(2) : profit.toFixed(2),
        },
        sales: filteredSales || [],
        expenses: filteredExpenses || [],
        purchases: filteredPurchases || [],
        dateRange: {
          start: dateRange.start,
          end: dateRange.end,
        },
      };

      const response = await api.exportReportToExcel(reportData);
      const blob = new Blob([response], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `report_${dateRange.start}_${dateRange.end}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Error exporting to Excel:", error);
      showError("Failed to export to Excel. Please try again.");
    }
  };

  const exportToPDF = () => {
    if (!printRef.current || !dateRange) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showError("Please allow popups to print the report");
      return;
    }

    const reportContent = printRef.current.innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Report - ${dateRange.start}${dateRange.start !== dateRange.end ? ` to ${dateRange.end}` : ""}</title>
          <style>
            @media print {
              @page { margin: 15mm; }
              body { margin: 0; }
              .no-print { display: none !important; }
            }
            body {
              font-family: Arial, sans-serif;
              padding: 20px;
              color: #000;
              background: #fff;
            }
            h1 { 
              color: #000; 
              margin-bottom: 10px; 
              font-size: 24px;
              border-bottom: 2px solid #000;
              padding-bottom: 10px;
            }
            h2 { 
              color: #000; 
              margin-top: 20px; 
              margin-bottom: 10px; 
              font-size: 18px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 15px 0;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
            }
            th {
              background-color: #f2f2f2;
              font-weight: bold;
            }
            .total {
              font-weight: bold;
              font-size: 1.1em;
            }
            .financial-flow {
              background-color: #f9f9f9;
            }
          </style>
        </head>
        <body>
          <h1>Isma Sports Complex - Financial Report</h1>
          <p><strong>Date Range:</strong> ${dateRange.start}${dateRange.start !== dateRange.end ? ` to ${dateRange.end}` : ""}</p>
          ${reportContent}
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <>
      <PageMeta
        title="Reports & Analysis | Isma Sports Complex"
        description="View sales, expenses and profit reports"
      />
      <div className="mb-6" ref={printRef}>
        <div className="flex items-center justify-between mb-4 no-print">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Reports & Analysis
          </h1>
          <div className="flex gap-2">
            <Link to="/reports/opening-balance">
              <Button size="sm" variant="outline">
              <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                Add Opening Balance
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2 no-print">
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
                <DatePicker
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <DatePicker
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        {dateRange && (
          <>
            {loading ? (
              <div className="text-center py-8 mb-6">
                <p className="text-gray-500">Loading report data...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-4 no-print">
                {openingBalance > 0 && (
                  <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Opening Balance
                    </p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      Rs. {openingBalance.toFixed(2)}
                    </p>
                  </div>
                )}
                <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Total Sales
                  </p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    Rs. {totalSales.toFixed(2)}
                  </p>
                </div>
                {totalPurchases > 0 && (
                  <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Total Purchases
                    </p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      Rs. {totalPurchases.toFixed(2)}
                    </p>
                  </div>
                )}
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
                    {isUsingBackendData ? "Closing Balance" : "Profit/Loss"}
                  </p>
                  <p
                    className={`text-2xl font-bold ${
                      (isUsingBackendData ? closingBalance : profit) >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    Rs. {(isUsingBackendData ? closingBalance : profit).toFixed(2)}
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
            )}

            <div className="mb-6 flex gap-2 no-print flex-wrap">
 
              <Button onClick={exportToExcel} size="sm" variant="outline">
                <DownloadIcon className="w-4 h-4 mr-2" />
                Export Excel
              </Button>
              <Button onClick={exportToPDF} size="sm">
                <DownloadIcon className="w-4 h-4 mr-2" />
                Print / PDF
              </Button>
             
            </div>

            {/* Financial Flow Table */}
            <div className="mb-6 p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
              <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
                Financial Flow Report
              </h2>
              {loading ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Loading report...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          Description
                        </th>
                        <th className="p-2 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                          Amount (Rs.)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {isUsingBackendData && (
                        <tr className="border-b border-gray-100 dark:border-gray-700">
                          <td className="p-2 font-semibold text-gray-800 dark:text-white">
                            Opening Balance
                          </td>
                          <td className="p-2 text-right font-semibold text-blue-600 dark:text-blue-400">
                            + Rs. {openingBalance.toFixed(2)}
                          </td>
                        </tr>
                      )}
                      <tr className="border-b border-gray-100 dark:border-gray-700">
                        <td className="p-2 font-semibold text-gray-800 dark:text-white">
                          Total Sales
                        </td>
                        <td className="p-2 text-right font-semibold text-green-600 dark:text-green-400">
                          + Rs. {totalSales.toFixed(2)}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100 dark:border-gray-700">
                        <td className="p-2 font-semibold text-gray-800 dark:text-white">
                          Total Purchases
                        </td>
                        <td className="p-2 text-right font-semibold text-red-600 dark:text-red-400">
                          - Rs. {totalPurchases.toFixed(2)}
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100 dark:border-gray-700">
                        <td className="p-2 font-semibold text-gray-800 dark:text-white">
                          Total Expenses
                        </td>
                        <td className="p-2 text-right font-semibold text-red-600 dark:text-red-400">
                          - Rs. {totalExpenses.toFixed(2)}
                        </td>
                      </tr>
                      <tr>
                        <td className="p-2 font-bold text-lg text-gray-800 dark:text-white">
                          {isUsingBackendData ? "Closing Balance" : "Net Profit/Loss"}
                        </td>
                        <td className={`p-2 text-right font-bold text-lg ${
                          (isUsingBackendData ? closingBalance : profit) >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}>
                          Rs. {(isUsingBackendData ? closingBalance : profit).toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Sales Report Table - Left Side */}
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
                        <>
                          {/* Individual Sales */}
                          {(filteredSales || []).map((sale) => {
                            if (!sale || !sale.id) return null;
                            const saleDate = sale.date ? new Date(sale.date) : (sale.createdAt ? new Date(sale.createdAt) : new Date());
                            return (
                              <tr
                                key={sale.id}
                                className="border-b border-gray-100 dark:border-gray-700"
                              >
                                <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                  {sale.billNumber || ""}
                                </td>
                                <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                  {saleDate.toLocaleDateString()}
                                </td>
                                <td className="p-2 text-gray-700 dark:text-gray-300 max-w-[150px]">
                                  <div className="line-clamp-3 truncate">
                                    {sale.customerName || "Walk-in"}
                                  </div>
                                </td>
                                <td className="p-2 text-right font-semibold text-gray-800 dark:text-white whitespace-nowrap">
                                  Rs. {Number(sale.total || 0).toFixed(2)}
                                </td>
                              </tr>
                            );
                          }).filter(Boolean)}
                          
                          {/* Combined Customer Totals - Only show if customer has multiple sales */}
                          {customerTotals.length > 0 && (
                            <>
                              <tr className="border-t-2 border-gray-300 dark:border-gray-600">
                                <td colSpan={4} className="p-2 font-bold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900">
                                  Customer Totals (Multiple Payments)
                                </td>
                              </tr>
                              {customerTotals.map((customer, idx) => (
                                <tr
                                  key={`customer-total-${idx}`}
                                  className="border-b border-gray-100 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20"
                                >
                                  <td className="p-2 text-gray-600 dark:text-gray-400 text-sm whitespace-nowrap">
                                    {customer.bills.length > 0 ? customer.bills.join(", ") : `${customer.count} bills`}
                                  </td>
                                  <td className="p-2 text-gray-600 dark:text-gray-400 text-sm whitespace-nowrap">
                                    Combined
                                  </td>
                                  <td className="p-2 font-semibold text-blue-700 dark:text-blue-400 max-w-[200px]">
                                    <div className="line-clamp-3">
                                      {customer.customerName} ({customer.count} payments)
                                    </div>
                                  </td>
                                  <td className="p-2 text-right font-bold text-blue-700 dark:text-blue-400 whitespace-nowrap">
                                    Rs. {customer.total.toFixed(2)}
                                  </td>
                                </tr>
                              ))}
                            </>
                          )}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Expenses Report Table - Right Side */}
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
                        (filteredExpenses || []).map((expense) => {
                          if (!expense || !expense.id) return null;
                          return (
                            <tr
                              key={expense.id}
                              className="border-b border-gray-100 dark:border-gray-700"
                            >
                              <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                {expense.date ? new Date(expense.date).toLocaleDateString() : ""}
                              </td>
                              <td className="p-2 text-gray-700 dark:text-gray-300 capitalize whitespace-nowrap">
                                {expense.category || ""}
                              </td>
                              <td className="p-2 text-gray-700 dark:text-gray-300 max-w-[200px]">
                                <div className="line-clamp-3 truncate">
                                  {expense.description || ""}
                                </div>
                              </td>
                              <td className="p-2 text-right font-semibold text-gray-800 dark:text-white whitespace-nowrap">
                                Rs. {Number(expense.amount || 0).toFixed(2)}
                              </td>
                            </tr>
                          );
                        }).filter(Boolean)
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
