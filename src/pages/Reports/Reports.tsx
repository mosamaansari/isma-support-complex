import { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Button from "../../components/ui/button/Button";
import { DownloadIcon, PlusIcon } from "../../icons";
import api from "../../services/api";
import { DailyReport, DateRangeReport } from "../../types";

export default function Reports() {
  const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly" | "yearly" | "custom">("daily");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<DailyReport | DateRangeReport | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      case "yearly":
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
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

  const loadReport = async () => {
    const dateRange = getDateRange();
    if (!dateRange) {
      setError("Please select date range");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      if (dateRange.start === dateRange.end) {
        // Daily report
        const dailyReport = await api.getDailyReport(dateRange.start);
        setReport(dailyReport);
      } else {
        // Date range report
        const rangeReport = await api.getDateRangeReport(dateRange.start, dateRange.end);
        setReport(rangeReport);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load report");
      console.error("Error loading report:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const dateRange = getDateRange();
    if (dateRange && (reportType !== "custom" || (startDate && endDate))) {
      loadReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportType, startDate, endDate]);

  const printRef = useRef<HTMLDivElement>(null);

  const exportToPDF = () => {
    if (!printRef.current || !report) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Please allow popups to print the report");
      return;
    }

    const dateRange = getDateRange();

    // Get the report content HTML
    const reportContent = printRef.current.innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Report - ${dateRange?.start}${dateRange?.start !== dateRange?.end ? ` to ${dateRange?.end}` : ""}</title>
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
            h3 { 
              color: #000; 
              margin-top: 15px; 
              margin-bottom: 8px; 
              font-size: 16px;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
              margin: 20px 0;
            }
            .summary-card {
              background: #f9f9f9;
              padding: 15px;
              border: 1px solid #ddd;
              border-radius: 5px;
            }
            .summary-card p {
              margin: 5px 0;
            }
            .summary-label {
              font-size: 12px;
              color: #666;
            }
            .summary-value {
              font-size: 20px;
              font-weight: bold;
              color: #000;
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
            p {
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <h1>Isma Sports Complex - Daily Report</h1>
          <p><strong>Date:</strong> ${dateRange?.start}${dateRange?.start !== dateRange?.end ? ` to ${dateRange?.end}` : ""}</p>
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

  const dateRange = getDateRange();
  const isDaily = report && "openingBalance" in report && !("summary" in report);
  const summary = isDaily ? null : (report as DateRangeReport)?.summary;

  return (
    <>
      <PageMeta
        title="Reports & Analysis | Isma Sports Complex"
        description="View comprehensive daily reports"
      />
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            Reports & Analysis
          </h1>
          <div className="flex gap-2">
            <Link to="/reports/opening-balance">
              <Button size="sm" variant="outline">
                <PlusIcon className="w-4 h-4 mr-2" />
                Add Opening Balance
              </Button>
            </Link>
            {report && (
              <Button onClick={exportToPDF} size="sm">
                <DownloadIcon className="w-4 h-4 mr-2" />
                Export to PDF
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2">
          <div>
            <Label>Report Type</Label>
            <select
              value={reportType}
              onChange={(e) =>
                setReportType(
                  e.target.value as "daily" | "weekly" | "monthly" | "yearly" | "custom"
                )
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
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

        {loading && (
          <div className="text-center py-8">
            <p className="text-gray-500">Loading report...</p>
          </div>
        )}

        {error && (
          <div className="p-4 mb-6 text-red-600 bg-red-50 rounded-lg dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {report && !loading && (
          <div ref={printRef}>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2 lg:grid-cols-4">
              {isDaily ? (
                <>
                  <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Opening Balance</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      Rs. {(report as DailyReport).openingBalance.total.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Sales</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      Rs. {(report as DailyReport).sales.total.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Purchases</p>
                    <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      Rs. {(report as DailyReport).purchases.total.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Closing Balance</p>
                    <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      Rs. {(report as DailyReport).closingBalance.total.toFixed(2)}
                    </p>
                  </div>
                </>
              ) : (
                summary && (
                  <>
                    <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Opening Balance</p>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        Rs. {summary.openingBalance.total.toFixed(2)}
                      </p>
                    </div>
                    <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Sales</p>
                      <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                        Rs. {summary.sales.total.toFixed(2)}
                      </p>
                    </div>
                    <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Purchases</p>
                      <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        Rs. {summary.purchases.total.toFixed(2)}
                      </p>
                    </div>
                    <div className="p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Closing Balance</p>
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        Rs. {summary.closingBalance.total.toFixed(2)}
                      </p>
                    </div>
                  </>
                )
              )}
            </div>

            {/* Detailed Report */}
            {isDaily ? (
              <div className="p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
                  Daily Report - {dateRange?.start}
                </h2>
                <div className="space-y-6">
                  <div>
                    <h3 className="mb-2 font-semibold text-gray-700 dark:text-gray-300">Opening Balance</h3>
                    <p>Cash: Rs. {(report as DailyReport).openingBalance.cash.toFixed(2)}</p>
                    {(report as DailyReport).openingBalance.cards.map((card) => (
                      <p key={card.cardId}>
                        {card.cardName}: Rs. {card.balance.toFixed(2)}
                      </p>
                    ))}
                    <p className="font-semibold">
                      Total: Rs. {(report as DailyReport).openingBalance.total.toFixed(2)}
                    </p>
                  </div>

                  <div>
                    <h3 className="mb-2 font-semibold text-gray-700 dark:text-gray-300">Sales</h3>
                    <p>Total: Rs. {(report as DailyReport).sales.total.toFixed(2)}</p>
                    <p>Cash: Rs. {(report as DailyReport).sales.cash.toFixed(2)}</p>
                    <p>Card: Rs. {(report as DailyReport).sales.card.toFixed(2)}</p>
                    <p>Credit: Rs. {(report as DailyReport).sales.credit.toFixed(2)}</p>
                    <p>Bills: {(report as DailyReport).sales.count}</p>
                  </div>

                  <div>
                    <h3 className="mb-2 font-semibold text-gray-700 dark:text-gray-300">Purchases</h3>
                    <p>Total: Rs. {(report as DailyReport).purchases.total.toFixed(2)}</p>
                    <p>Cash: Rs. {(report as DailyReport).purchases.cash.toFixed(2)}</p>
                    <p>Card: Rs. {(report as DailyReport).purchases.card.toFixed(2)}</p>
                    <p>Count: {(report as DailyReport).purchases.count}</p>
                  </div>

                  <div>
                    <h3 className="mb-2 font-semibold text-gray-700 dark:text-gray-300">Expenses</h3>
                    <p>Total: Rs. {(report as DailyReport).expenses.total.toFixed(2)}</p>
                    <p>Cash: Rs. {(report as DailyReport).expenses.cash.toFixed(2)}</p>
                    <p>Card: Rs. {(report as DailyReport).expenses.card.toFixed(2)}</p>
                    <p>Count: {(report as DailyReport).expenses.count}</p>
                  </div>

                  <div>
                    <h3 className="mb-2 font-semibold text-gray-700 dark:text-gray-300">Closing Balance</h3>
                    <p>Cash: Rs. {(report as DailyReport).closingBalance.cash.toFixed(2)}</p>
                    {(report as DailyReport).closingBalance.cards.map((card) => (
                      <p key={card.cardId}>
                        {card.cardName}: Rs. {card.balance.toFixed(2)}
                      </p>
                    ))}
                    <p className="font-semibold">
                      Total: Rs. {(report as DailyReport).closingBalance.total.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
                  Date Range Report - {dateRange?.start} to {dateRange?.end}
                </h2>
                {summary && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="mb-2 font-semibold text-gray-700 dark:text-gray-300">Summary</h3>
                      <p>Opening Balance: Rs. {summary.openingBalance.total.toFixed(2)}</p>
                      <p>Total Sales: Rs. {summary.sales.total.toFixed(2)}</p>
                      <p>Total Purchases: Rs. {summary.purchases.total.toFixed(2)}</p>
                      <p>Total Expenses: Rs. {summary.expenses.total.toFixed(2)}</p>
                      <p className="font-semibold">
                        Closing Balance: Rs. {summary.closingBalance.total.toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
