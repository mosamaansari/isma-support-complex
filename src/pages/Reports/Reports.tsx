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
import { extractErrorMessage } from "../../utils/errorHandler";

export default function Reports() {
  const { getSalesByDateRange, getExpensesByDateRange, currentUser, bankAccounts } = useData();
  const { showError } = useAlert();
  const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly" | "custom">("daily");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const printRef = useRef<HTMLDivElement>(null);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [dateRangeReport, setDateRangeReport] = useState<DateRangeReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [previousDayBalance, setPreviousDayBalance] = useState<{
    cashBalance: number;
    bankBalances: Array<{ bankAccountId: string; balance: number }>;
  } | null>(null);
  const [isDateWiseFlowExpanded, setIsDateWiseFlowExpanded] = useState(false);

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
          
          // Load previous day balance for daily report
          try {
            const prevBalance = await api.getPreviousDayClosingBalance(dateRange.start);
            if (prevBalance) {
              setPreviousDayBalance({
                cashBalance: prevBalance.cashBalance || 0,
                bankBalances: prevBalance.bankBalances || [],
              });
            } else {
              setPreviousDayBalance({ cashBalance: 0, bankBalances: [] });
            }
          } catch (e) {
            console.error("Error loading previous day balance:", e);
            setPreviousDayBalance({ cashBalance: 0, bankBalances: [] });
          }
        } else {
          const report = await api.getDateRangeReport(dateRange.start, dateRange.end);
          setDateRangeReport(report);
          setDailyReport(null);
          setPreviousDayBalance(null); // For date range, we'll show per-day in the report
        }
      } catch (error: any) {
        console.error("Error loading report:", error);
        showError(extractErrorMessage(error) || "Failed to load report");
        setDailyReport(null);
        setDateRangeReport(null);
        setPreviousDayBalance(null);
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
  let openingCash = 0;
  let openingBankTotal = 0;
  let closingBalance = 0;
  let closingCash = 0;
  let closingBankTotal = 0;
  let profit = 0;
  let openingBankBalances: Array<{ bankAccountId: string; bankName: string; accountNumber: string; balance: number }> = [];

  if (isUsingBackendData && reportType === "daily" && dailyReport) {
    filteredSales = dailyReport.sales?.items || [];
    filteredExpenses = dailyReport.expenses?.items || [];
    filteredPurchases = dailyReport.purchases?.items || [];
    totalSales = dailyReport.sales?.total || 0;
    totalExpenses = dailyReport.expenses?.total || 0;
    totalPurchases = dailyReport.purchases?.total || 0;
    openingBalance = dailyReport.openingBalance?.total || 0;
    openingCash = dailyReport.openingBalance?.cash || 0;
    // Backend now returns banks properly
    const openingBanks = (dailyReport.openingBalance as any)?.banks || [];
    openingBankTotal = openingBanks.reduce((sum: number, bank: any) => sum + Number(bank.balance || 0), 0);
    
    closingBalance = dailyReport.closingBalance?.total || 0;
    closingCash = dailyReport.closingBalance?.cash || 0;
    const closingBanks = (dailyReport.closingBalance as any)?.banks || [];
    closingBankTotal = closingBanks.reduce((sum: number, bank: any) => sum + Number(bank.balance || 0), 0);
    
    profit = totalSales - totalExpenses - totalPurchases;
  } else if (isUsingBackendData && dateRangeReport) {
    filteredSales = dateRangeReport.sales || [];
    filteredExpenses = dateRangeReport.expenses || [];
    filteredPurchases = dateRangeReport.purchases || [];
    totalSales = dateRangeReport.summary?.sales?.total || 0;
    totalExpenses = dateRangeReport.summary?.expenses?.total || 0;
    totalPurchases = dateRangeReport.summary?.purchases?.total || 0;
    openingBalance = dateRangeReport.summary?.openingBalance?.total || 0;
    openingCash = dateRangeReport.summary?.openingBalance?.cash || 0;
    openingBankTotal = dateRangeReport.summary?.openingBalance?.cards || 0;
    closingBalance = dateRangeReport.summary?.closingBalance?.total || 0;
    closingCash = dateRangeReport.summary?.closingBalance?.cash || 0;
    closingBankTotal = dateRangeReport.summary?.closingBalance?.cards || 0;
    profit = totalSales - totalExpenses - totalPurchases;
  } else if (dateRange) {
    // Fallback to frontend data
    filteredSales = getSalesByDateRange(dateRange.start, dateRange.end) || [];
    filteredExpenses = getExpensesByDateRange(dateRange.start, dateRange.end) || [];
    totalSales = filteredSales.reduce((sum, s) => sum + Number(s?.total || 0), 0);
    totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e?.amount || 0), 0);
    profit = totalSales - totalExpenses;
    closingBalance = profit;
    closingCash = profit;
  }

  // Map bank balances from previous day balance
  if (previousDayBalance && bankAccounts) {
    openingBankBalances = bankAccounts.map((bank) => {
      const bankBalance = previousDayBalance.bankBalances.find(
        (b) => b.bankAccountId === bank.id
      );
      return {
        bankAccountId: bank.id,
        bankName: bank.bankName,
        accountNumber: bank.accountNumber,
        balance: bankBalance?.balance || 0,
      };
    });
    openingBankTotal = openingBankBalances.reduce((sum, b) => sum + (b.balance || 0), 0);
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

  const exportToPDF = async () => {
    if (!dateRange) return;

    // For daily reports, use backend PDF generation
    if (reportType === "daily" && dailyReport) {
      try {
        const blob = await api.generateDailyReportPDF(dateRange.start);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `daily-report-${dateRange.start}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      } catch (error: any) {
        console.error("Error generating PDF:", error);
        showError("Failed to generate PDF. Falling back to print view.");
        // Fall through to print view
      }
    }

    // Fallback to print view for date range reports
    if (!printRef.current) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showError("Please allow popups to print the report");
      return;
    }

    // Clone the content and remove no-print classes for printing
    const contentClone = printRef.current.cloneNode(true) as HTMLElement;
    const noPrintElements = contentClone.querySelectorAll('.no-print');
    noPrintElements.forEach((el) => el.remove());

    const reportContent = contentClone.innerHTML;

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
              page-break-inside: auto;
            }
            tr {
              page-break-inside: avoid;
              page-break-after: auto;
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
            .bg-blue-50, .bg-green-50, .bg-gray-50 {
              background-color: #f0f0f0 !important;
            }
            .text-blue-600, .text-green-600, .text-red-600 {
              color: #000 !important;
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
              <>
                {/* Previous Day Balance Section - Only for daily reports */}
                {reportType === "daily" && previousDayBalance && (
                  <div className="mb-6 p-6 bg-gray-50 dark:bg-gray-900/20 rounded-lg border-2 border-gray-200 dark:border-gray-800">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
                      Previous Day Closing Balance
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Cash Balance</p>
                        <p className="text-2xl font-bold text-blue-600">
                          Rs. {Number(previousDayBalance.cashBalance || 0).toFixed(2)}
                        </p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Bank Balance</p>
                        <p className="text-2xl font-bold text-green-600">
                          Rs. {Number(previousDayBalance.bankBalances?.reduce((sum, b) => sum + Number(b.balance || 0), 0) || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    {openingBankBalances.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Bank-wise Balances:</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {openingBankBalances.map((bank) => (
                            <div key={bank.bankAccountId} className="bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-700">
                              <p className="text-xs text-gray-500 dark:text-gray-400">{bank.bankName}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">{bank.accountNumber}</p>
                              <p className="text-sm font-bold text-gray-800 dark:text-white">Rs. {Number(bank.balance || 0).toFixed(2)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Summary Cards */}
                <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-4 no-print">
                  {openingBalance > 0 && (
                    <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Opening Balance
                      </p>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        Rs. {openingBalance.toFixed(2)}
                      </p>
                      {openingCash > 0 || openingBankTotal > 0 ? (
                        <div className="mt-2 text-xs text-gray-500">
                          <div>Cash: Rs. {openingCash.toFixed(2)}</div>
                          {openingBankTotal > 0 && <div>Bank: Rs. {openingBankTotal.toFixed(2)}</div>}
                        </div>
                      ) : null}
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
                    {isUsingBackendData && (closingCash > 0 || closingBankTotal > 0) ? (
                      <div className="mt-2 text-xs text-gray-500">
                        <div>Cash: Rs. {closingCash.toFixed(2)}</div>
                        {closingBankTotal > 0 && <div>Bank: Rs. {closingBankTotal.toFixed(2)}</div>}
                      </div>
                    ) : null}
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
              </>
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

            {/* Financial Flow Table - Summary */}
            <div className="mb-6 p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
              <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
                Financial Flow Report - Summary
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
                        <>
                          <tr className="border-b border-gray-100 dark:border-gray-700">
                            <td className="p-2 font-semibold text-gray-800 dark:text-white">
                              Opening Balance (Cash)
                            </td>
                            <td className="p-2 text-right font-semibold text-blue-600 dark:text-blue-400">
                              + Rs. {openingCash.toFixed(2)}
                            </td>
                          </tr>
                          {openingBankTotal > 0 && (
                            <tr className="border-b border-gray-100 dark:border-gray-700">
                              <td className="p-2 font-semibold text-gray-800 dark:text-white">
                                Opening Balance (Bank)
                              </td>
                              <td className="p-2 text-right font-semibold text-blue-600 dark:text-blue-400">
                                + Rs. {openingBankTotal.toFixed(2)}
                              </td>
                            </tr>
                          )}
                          <tr className="border-b border-gray-100 dark:border-gray-700">
                            <td className="p-2 font-semibold text-gray-800 dark:text-white">
                              Opening Balance (Total)
                            </td>
                            <td className="p-2 text-right font-semibold text-blue-600 dark:text-blue-400">
                              + Rs. {openingBalance.toFixed(2)}
                            </td>
                          </tr>
                        </>
                      )}
                      <tr className="border-b border-gray-100 dark:border-gray-700">
                        <td className="p-2 font-semibold text-gray-800 dark:text-white">
                          Total Sales
                        </td>
                        <td className="p-2 text-right font-semibold text-green-600 dark:text-green-400">
                          + Rs. {totalSales.toFixed(2)}
                        </td>
                      </tr>
                      {totalPurchases > 0 && (
                        <tr className="border-b border-gray-100 dark:border-gray-700">
                          <td className="p-2 font-semibold text-gray-800 dark:text-white">
                            Total Purchases
                          </td>
                          <td className="p-2 text-right font-semibold text-red-600 dark:text-red-400">
                            - Rs. {totalPurchases.toFixed(2)}
                          </td>
                        </tr>
                      )}
                      <tr className="border-b border-gray-100 dark:border-gray-700">
                        <td className="p-2 font-semibold text-gray-800 dark:text-white">
                          Total Expenses
                        </td>
                        <td className="p-2 text-right font-semibold text-red-600 dark:text-red-400">
                          - Rs. {totalExpenses.toFixed(2)}
                        </td>
                      </tr>
                      {isUsingBackendData && (
                        <>
                          <tr className="border-b border-gray-100 dark:border-gray-700">
                            <td className="p-2 font-semibold text-gray-800 dark:text-white">
                              Closing Balance (Cash)
                            </td>
                            <td className="p-2 text-right font-semibold text-green-600 dark:text-green-400">
                              Rs. {closingCash.toFixed(2)}
                            </td>
                          </tr>
                          {closingBankTotal > 0 && (
                            <tr className="border-b border-gray-100 dark:border-gray-700">
                              <td className="p-2 font-semibold text-gray-800 dark:text-white">
                                Closing Balance (Bank)
                              </td>
                              <td className="p-2 text-right font-semibold text-green-600 dark:text-green-400">
                                Rs. {closingBankTotal.toFixed(2)}
                              </td>
                            </tr>
                          )}
                        </>
                      )}
                      <tr>
                        <td className="p-2 font-bold text-lg text-gray-800 dark:text-white">
                          {isUsingBackendData ? "Closing Balance (Total)" : "Net Profit/Loss"}
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

            {/* Date-wise Financial Flow - For Custom Range and Weekly/Monthly */}
            {isUsingBackendData && dateRangeReport && dateRangeReport.dailyReports && dateRangeReport.dailyReports.length > 0 && (
              <div className="mb-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                <button
                  onClick={() => setIsDateWiseFlowExpanded(!isDateWiseFlowExpanded)}
                  className="w-full p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-t-lg"
                >
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                    Date-wise Financial Flow Report
                  </h2>
                  <svg
                    className={`w-5 h-5 text-gray-600 dark:text-gray-400 transition-transform ${
                      isDateWiseFlowExpanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isDateWiseFlowExpanded ? "max-h-[600px]" : "max-h-0"
                  }`}
                >
                  <div className={`p-6 pt-0 space-y-6 ${isDateWiseFlowExpanded ? "overflow-y-auto h-[600px]" : ""}`}>
                  {dateRangeReport.dailyReports.map((dailyReport, idx) => {
                    const prevDayClosing = idx > 0 
                      ? dateRangeReport.dailyReports[idx - 1].closingBalance
                      : null;
                    const prevDayCash = prevDayClosing?.cash || 0;
                    const prevDayBank = prevDayClosing?.cards?.reduce((sum: number, card: any) => sum + (card.balance || 0), 0) || 0;
                    
                    return (
                      <div key={dailyReport.date} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
                          <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                            {new Date(dailyReport.date).toLocaleDateString('en-US', { 
                              weekday: 'long', 
                              year: 'numeric', 
                              month: 'long', 
                              day: 'numeric' 
                            })}
                          </h3>
                          {idx > 0 && (
                            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                              <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2">
                                <span className="text-gray-600 dark:text-gray-400">Previous Day Cash: </span>
                                <span className="font-semibold text-blue-600">Rs. {prevDayCash.toFixed(2)}</span>
                              </div>
                              {prevDayBank > 0 && (
                                <div className="bg-green-50 dark:bg-green-900/20 rounded p-2">
                                  <span className="text-gray-600 dark:text-gray-400">Previous Day Bank: </span>
                                  <span className="font-semibold text-green-600">Rs. {prevDayBank.toFixed(2)}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="p-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                                  Description
                                </th>
                                <th className="p-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                                  Cash (Rs.)
                                </th>
                                <th className="p-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                                  Bank (Rs.)
                                </th>
                                <th className="p-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                                  Total (Rs.)
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b border-gray-100 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/10">
                                <td className="p-2 font-semibold text-gray-800 dark:text-white">
                                  Opening Balance
                                </td>
                                <td className="p-2 text-right font-semibold text-blue-600 dark:text-blue-400">
                                  {dailyReport.openingBalance?.cash?.toFixed(2) || "0.00"}
                                </td>
                                <td className="p-2 text-right font-semibold text-blue-600 dark:text-blue-400">
                                  {(dailyReport.openingBalance?.cards?.reduce((sum: number, card: any) => sum + (card.balance || 0), 0) || 0).toFixed(2)}
                                </td>
                                <td className="p-2 text-right font-semibold text-blue-600 dark:text-blue-400">
                                  {(dailyReport.openingBalance?.total || 0).toFixed(2)}
                                </td>
                              </tr>
                              <tr className="border-b border-gray-100 dark:border-gray-700 bg-green-50 dark:bg-green-900/10">
                                <td className="p-2 font-semibold text-gray-800 dark:text-white">
                                  Sales
                                </td>
                                <td className="p-2 text-right font-semibold text-green-600 dark:text-green-400">
                                  {(dailyReport.sales?.cash || 0).toFixed(2)}
                                </td>
                                <td className="p-2 text-right font-semibold text-green-600 dark:text-green-400">
                                  {(dailyReport.sales?.bank_transfer || 0).toFixed(2)}
                                </td>
                                <td className="p-2 text-right font-semibold text-green-600 dark:text-green-400">
                                  {(dailyReport.sales?.total || 0).toFixed(2)}
                                </td>
                              </tr>
                              {dailyReport.purchases && dailyReport.purchases.total > 0 && (
                                <tr className="border-b border-gray-100 dark:border-gray-700 bg-orange-50 dark:bg-orange-900/10">
                                  <td className="p-2 font-semibold text-gray-800 dark:text-white">
                                    Purchases
                                  </td>
                                  <td className="p-2 text-right font-semibold text-orange-600 dark:text-orange-400">
                                    -{(dailyReport.purchases?.cash || 0).toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right font-semibold text-orange-600 dark:text-orange-400">
                                    -{(dailyReport.purchases?.bank_transfer || 0).toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right font-semibold text-orange-600 dark:text-orange-400">
                                    -{(dailyReport.purchases?.total || 0).toFixed(2)}
                                  </td>
                                </tr>
                              )}
                              {dailyReport.expenses && dailyReport.expenses.total > 0 && (
                                <tr className="border-b border-gray-100 dark:border-gray-700 bg-red-50 dark:bg-red-900/10">
                                  <td className="p-2 font-semibold text-gray-800 dark:text-white">
                                    Expenses
                                  </td>
                                  <td className="p-2 text-right font-semibold text-red-600 dark:text-red-400">
                                    -{(dailyReport.expenses?.cash || 0).toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right font-semibold text-red-600 dark:text-red-400">
                                    -{(dailyReport.expenses?.bank_transfer || 0).toFixed(2)}
                                  </td>
                                  <td className="p-2 text-right font-semibold text-red-600 dark:text-red-400">
                                    -{(dailyReport.expenses?.total || 0).toFixed(2)}
                                  </td>
                                </tr>
                              )}
                              <tr className="bg-gray-50 dark:bg-gray-900/20">
                                <td className="p-2 font-bold text-gray-800 dark:text-white">
                                  Closing Balance
                                </td>
                                <td className="p-2 text-right font-bold text-green-600 dark:text-green-400">
                                  {(dailyReport.closingBalance?.cash || 0).toFixed(2)}
                                </td>
                                <td className="p-2 text-right font-bold text-green-600 dark:text-green-400">
                                  {(dailyReport.closingBalance?.cards?.reduce((sum: number, card: any) => sum + (card.balance || 0), 0) || 0).toFixed(2)}
                                </td>
                                <td className="p-2 text-right font-bold text-green-600 dark:text-green-400">
                                  {(dailyReport.closingBalance?.total || 0).toFixed(2)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              </div>
            )}

            {/* Purchases Report Table - Full Width if exists */}
            {filteredPurchases.length > 0 && (
              <div className="mb-6 p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
                  Purchases Report
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          Date
                        </th>
                        <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          Supplier
                        </th>
                        <th className="p-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                          Items
                        </th>
                        <th className="p-2 text-right text-sm font-medium text-gray-700 dark:text-gray-300">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPurchases.map((purchase) => {
                        if (!purchase || !purchase.id) return null;
                        const purchaseDate = purchase.date ? new Date(purchase.date) : (purchase.createdAt ? new Date(purchase.createdAt) : new Date());
                        const items = (purchase.items || []) as Array<{ productName: string; quantity: number }>;
                        return (
                          <tr
                            key={purchase.id}
                            className="border-b border-gray-100 dark:border-gray-700"
                          >
                            <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {purchaseDate.toLocaleString('en-US', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </td>
                            <td className="p-2 text-gray-700 dark:text-gray-300">
                              {purchase.supplierName || "N/A"}
                            </td>
                            <td className="p-2 text-gray-700 dark:text-gray-300 max-w-[200px]">
                              <div className="line-clamp-2 truncate">
                                {items.length > 0 
                                  ? items.map((item) => `${item.productName} (${item.quantity})`).join(", ")
                                  : "N/A"}
                              </div>
                            </td>
                            <td className="p-2 text-right font-semibold text-gray-800 dark:text-white whitespace-nowrap">
                              Rs. {Number(purchase.total || 0).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900">
                        <td colSpan={3} className="p-2 font-bold text-gray-800 dark:text-white">
                          Total Purchases
                        </td>
                        <td className="p-2 text-right font-bold text-orange-600 dark:text-orange-400">
                          Rs. {totalPurchases.toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

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
                            const payments = (sale.payments as Array<{ type: string; amount: number; date?: string }> | null) || [];
                            const hasMultiplePayments = payments.length > 1;
                            
                            // If no payments or single payment, show as before
                            if (payments.length === 0 || !hasMultiplePayments) {
                              return (
                                <tr
                                  key={sale.id}
                                  className="border-b border-gray-100 dark:border-gray-700"
                                >
                                  <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                    {sale.billNumber || ""}
                                  </td>
                                  <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                    {saleDate.toLocaleString('en-US', { 
                                      year: 'numeric', 
                                      month: 'short', 
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </td>
                                  <td className="p-2 text-gray-700 dark:text-gray-300 max-w-[150px]">
                                    <div className="line-clamp-3 truncate">
                                      {sale.customerName || "Walk-in"}
                                    </div>
                                  </td>
                                  <td className="p-2 text-right font-semibold text-gray-800 dark:text-white whitespace-nowrap">
                                    Rs. {Number(sale.total || 0).toFixed(2)}
                                    {payments.length > 0 && (
                                      <div className="text-xs text-gray-500 mt-1">
                                        {payments[0].type.toUpperCase()}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              );
                            }
                            
                            // If multiple payments, show each payment as a separate row
                            return payments.map((payment, paymentIdx) => {
                              const paymentDate = payment.date ? new Date(payment.date) : saleDate;
                              return (
                                <tr
                                  key={`${sale.id}-payment-${paymentIdx}`}
                                  className="border-b border-gray-100 dark:border-gray-700"
                                >
                                  <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                    {sale.billNumber || ""}
                                    {paymentIdx > 0 && (
                                      <span className="text-xs text-gray-500 ml-1">(Payment {paymentIdx + 1})</span>
                                    )}
                                  </td>
                                  <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                    {paymentDate.toLocaleString('en-US', { 
                                      year: 'numeric', 
                                      month: 'short', 
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </td>
                                  <td className="p-2 text-gray-700 dark:text-gray-300 max-w-[150px]">
                                    <div className="line-clamp-3 truncate">
                                      {sale.customerName || "Walk-in"}
                                    </div>
                                  </td>
                                  <td className="p-2 text-right font-semibold text-gray-800 dark:text-white whitespace-nowrap">
                                    <div>Rs. {Number(payment.amount || 0).toFixed(2)}</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                      {payment.type.toUpperCase()}
                                    </div>
                                  </td>
                                </tr>
                              );
                            });
                          }).flat().filter(Boolean)}
                          
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
                                {expense.date ? new Date(expense.date).toLocaleString('en-US', { 
                                  year: 'numeric', 
                                  month: 'short', 
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }) : ""}
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
