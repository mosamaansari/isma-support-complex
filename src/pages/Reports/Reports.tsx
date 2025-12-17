import { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import { useAlert } from "../../context/AlertContext";
import DatePicker from "../../components/form/DatePicker";
import Label from "../../components/form/Label";
import Button from "../../components/ui/button/Button";
import { DownloadIcon, PlusIcon } from "../../icons";
import api from "../../services/api";

export default function Reports() {
  const { getSalesByDateRange, getExpensesByDateRange, currentUser } = useData();
  const { showError } = useAlert();
  const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly" | "custom">("daily");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [openingBalance, setOpeningBalance] = useState<{
    cash: number;
    cards: Array<{ cardId: string; cardName: string; balance: number }>;
    total: number;
  } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

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

  const loadOpeningBalance = async (date: string) => {
    try {
      const balance = await api.getOpeningBalance(date);
      if (balance) {
        const cards = balance.cardBalances || [];
        const cardTotal = cards.reduce((sum: number, cb: any) => sum + Number(cb.balance || 0), 0);
        setOpeningBalance({
          cash: Number(balance.cashBalance || 0),
          cards: cards.map((cb: any) => ({
            cardId: cb.cardId,
            cardName: cb.cardName || "Card",
            balance: Number(cb.balance || 0),
          })),
          total: Number(balance.cashBalance || 0) + cardTotal,
        });
      } else {
        setOpeningBalance(null);
      }
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error("Error loading opening balance:", error);
      }
      setOpeningBalance(null);
    }
  };

  useEffect(() => {
    const dateRange = getDateRange();
    if (dateRange) {
      // Load opening balance for the start date
      loadOpeningBalance(dateRange.start);
    }
  }, [reportType, startDate, endDate]);

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
  const filteredSales = dateRange
    ? (getSalesByDateRange(dateRange.start, dateRange.end) || [])
    : [];
  const filteredExpenses = dateRange
    ? (getExpensesByDateRange(dateRange.start, dateRange.end) || [])
    : [];

  const totalSales = (filteredSales || []).reduce((sum, s) => sum + Number(s?.total || 0), 0);
  const totalExpenses = (filteredExpenses || []).reduce((sum, e) => sum + Number(e?.amount || 0), 0);
  const openingTotal = openingBalance?.total || 0;
  const combinedTotal = openingTotal + totalSales;
  const closingBalance = combinedTotal - totalExpenses;
  const profit = totalSales - totalExpenses;

  const exportToCSV = () => {
    if (!dateRange) return;

    const csvRows = [
      ["Report Type", reportType],
      ["Date Range", `${dateRange.start} to ${dateRange.end}`],
      [],
      ["Opening Balance", openingTotal.toFixed(2)],
      ["Total Sales", totalSales.toFixed(2)],
      ["Combined (Opening + Sales)", combinedTotal.toFixed(2)],
      ["Total Expenses", totalExpenses.toFixed(2)],
      ["Closing Balance", closingBalance.toFixed(2)],
      [],
      ["Sales Report"],
      ["Bill Number", "Date", "Customer", "Total"],
      ...(filteredSales || []).map((s) => [
        s?.billNumber || "",
        s?.createdAt ? new Date(s.createdAt).toLocaleDateString() : "",
        s?.customerName || "Walk-in",
        Number(s?.total || 0).toFixed(2),
      ]),
      [],
      ["Expenses Report"],
      ["Date", "Category", "Description", "Amount"],
      ...(filteredExpenses || []).map((e) => [
        e?.date ? new Date(e.date).toLocaleDateString() : "",
        e?.category || "",
        e?.description || "",
        Number(e?.amount || 0).toFixed(2),
      ]),
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

  const exportToExcel = async () => {
    if (!dateRange) return;

    try {
      const reportData = {
        summary: {
          "Opening Balance": openingTotal.toFixed(2),
          "Total Sales": totalSales.toFixed(2),
          "Combined (Opening + Sales)": combinedTotal.toFixed(2),
          "Total Expenses": totalExpenses.toFixed(2),
          "Closing Balance": closingBalance.toFixed(2),
          "Profit/Loss": profit.toFixed(2),
        },
        sales: filteredSales || [],
        expenses: filteredExpenses || [],
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
                <PlusIcon className="w-4 h-4 mr-2" />
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
            <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-4 no-print">
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

            <div className="mb-6 flex gap-2 no-print flex-wrap">
              <Button onClick={exportToCSV} size="sm" variant="outline">
                <DownloadIcon className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={exportToExcel} size="sm" variant="outline">
                <DownloadIcon className="w-4 h-4 mr-2" />
                Export Excel
              </Button>
              <Button onClick={exportToPDF} size="sm">
                <DownloadIcon className="w-4 h-4 mr-2" />
                Print / PDF
              </Button>
              <Button 
                onClick={() => {
                  if (dateRange) {
                    window.open(`/reports/payments?startDate=${dateRange.start}&endDate=${dateRange.end}&type=all`, "_blank");
                  }
                }}
                size="sm"
                variant="outline"
                className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400"
              >
                <DownloadIcon className="w-4 h-4 mr-2" />
                Print All Payments
              </Button>
            </div>

            {/* Financial Flow Table */}
            <div className="mb-6 p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
              <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
                Financial Flow Report
              </h2>
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
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      <td className="p-2 font-semibold text-gray-800 dark:text-white">
                        Opening Balance
                      </td>
                      <td className="p-2 text-right font-semibold text-gray-800 dark:text-white">
                        {openingTotal > 0 ? `+ Rs. ${openingTotal.toFixed(2)}` : "Rs. 0.00"}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      <td className="p-2 pl-6 text-gray-700 dark:text-gray-300">
                        Cash
                      </td>
                      <td className="p-2 text-right text-gray-700 dark:text-gray-300">
                        Rs. {(openingBalance?.cash || 0).toFixed(2)}
                      </td>
                    </tr>
                    {openingBalance?.cards.map((card) => (
                      <tr key={card.cardId} className="border-b border-gray-100 dark:border-gray-700">
                        <td className="p-2 pl-6 text-gray-700 dark:text-gray-300">
                          {card.cardName}
                        </td>
                        <td className="p-2 text-right text-gray-700 dark:text-gray-300">
                          Rs. {card.balance.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      <td className="p-2 font-semibold text-gray-800 dark:text-white">
                        Total Sales
                      </td>
                      <td className="p-2 text-right font-semibold text-gray-800 dark:text-white">
                        + Rs. {totalSales.toFixed(2)}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      <td className="p-2 font-semibold text-gray-800 dark:text-white">
                        Combined (Opening + Sales)
                      </td>
                      <td className="p-2 text-right font-semibold text-gray-800 dark:text-white">
                        Rs. {combinedTotal.toFixed(2)}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-100 dark:border-gray-700">
                      <td className="p-2 font-semibold text-gray-800 dark:text-white">
                        Total Expenses
                      </td>
                      <td className="p-2 text-right font-semibold text-gray-800 dark:text-white">
                        - Rs. {totalExpenses.toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 font-bold text-lg text-gray-800 dark:text-white">
                        Closing Balance
                      </td>
                      <td className="p-2 text-right font-bold text-lg text-gray-800 dark:text-white">
                        Rs. {closingBalance.toFixed(2)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
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
                        (filteredSales || []).map((sale) => {
                          if (!sale || !sale.id) return null;
                          return (
                            <tr
                              key={sale.id}
                              className="border-b border-gray-100 dark:border-gray-700"
                            >
                              <td className="p-2 text-gray-700 dark:text-gray-300">
                                {sale.billNumber || ""}
                              </td>
                              <td className="p-2 text-gray-700 dark:text-gray-300">
                                {sale.createdAt ? new Date(sale.createdAt).toLocaleDateString() : ""}
                              </td>
                              <td className="p-2 text-gray-700 dark:text-gray-300">
                                {sale.customerName || "Walk-in"}
                              </td>
                              <td className="p-2 text-right font-semibold text-gray-800 dark:text-white">
                                Rs. {Number(sale.total || 0).toFixed(2)}
                              </td>
                            </tr>
                          );
                        }).filter(Boolean)
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
                              <td className="p-2 text-gray-700 dark:text-gray-300">
                                {expense.date ? new Date(expense.date).toLocaleDateString() : ""}
                              </td>
                              <td className="p-2 text-gray-700 dark:text-gray-300 capitalize">
                                {expense.category || ""}
                              </td>
                              <td className="p-2 text-gray-700 dark:text-gray-300">
                                {expense.description || ""}
                              </td>
                              <td className="p-2 text-right font-semibold text-gray-800 dark:text-white">
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
