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
import { getTodayDate, formatBackendDate, parseUTCDateString } from "../../utils/dateHelpers";
import { extractErrorMessage } from "../../utils/errorHandler";
import { formatCompleteAmount } from "../../utils/priceHelpers";

export default function Reports() {
  const {
    getSalesByDateRange,
    getExpensesByDateRange,
    currentUser,
    bankAccounts,
  } = useData();
  const { showError } = useAlert();
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const printRef = useRef<HTMLDivElement>(null);
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null);
  const [dateRangeReport, setDateRangeReport] =
    useState<DateRangeReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [previousDayBalance, setPreviousDayBalance] = useState<{
    cashBalance: number;
    bankBalances: Array<{ bankAccountId: string; balance: number }>;
  } | null>(null);
  const [isDateWiseFlowExpanded, setIsDateWiseFlowExpanded] = useState(false);
  const [chronologicalTransactions, setChronologicalTransactions] = useState<
    any[]
  >([]);

  const getDateRange = () => {
    // Always use startDate and endDate directly
    if (!startDate || !endDate) return null;
    return {
      start: startDate,
      end: endDate,
    };
  };

  // Load reports from backend API
  useEffect(() => {
    const loadReport = async () => {
      const dateRange = getDateRange();
      if (!dateRange || !currentUser) return;

      setLoading(true);
      let loadedDateRangeReport: DateRangeReport | null = null;

      try {
        // Always use date range API - when startDate === endDate, it will show single day data
        const report = await api.getDateRangeReport(
          dateRange.start,
          dateRange.end
        );
        loadedDateRangeReport = report;
        setDateRangeReport(report);
        setDailyReport(null);
        
        // Load previous day balance if startDate === endDate (single day report)
        if (dateRange.start === dateRange.end) {
          try {
            const prevBalance = await api.getPreviousDayClosingBalance(
              dateRange.start
            );
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
          setPreviousDayBalance(null); // For date range, we'll show per-day in the report
        }
      } catch (error: any) {
        console.error("Error loading report:", error);
        showError(extractErrorMessage(error) || "Failed to load report");
        setDailyReport(null);
        setDateRangeReport(null);
        setPreviousDayBalance(null);
        setChronologicalTransactions([]);
      } finally {
        setLoading(false);
      }

      // Compute chronological transactions using loaded data directly
      const computeTransactions = (
        dateRangeReportData: DateRangeReport | null
      ) => {
        if (dateRangeReportData?.transactions) {
          // Date range report has transactions array - use them directly
          // Convert datetime strings to Date objects if needed, then sort
          const sortedTransactions = [...dateRangeReportData.transactions]
            .map((t: any) => ({
              ...t,
              datetime: t.datetime instanceof Date 
                ? t.datetime 
                : new Date(t.datetime || t.date || 0)
            }))
            .sort((a, b) => {
              const dateA = a.datetime instanceof Date ? a.datetime : new Date(a.datetime);
              const dateB = b.datetime instanceof Date ? b.datetime : new Date(b.datetime);
              return dateA.getTime() - dateB.getTime();
            });
          setChronologicalTransactions(sortedTransactions);
          return;
        }
        setChronologicalTransactions([]);
      };

      // Compute transactions after loading using the directly loaded data
      computeTransactions(loadedDateRangeReport);
    };

    loadReport();
  }, [startDate, endDate, currentUser]);

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
  const isUsingBackendData = !!dateRangeReport;
  const isSingleDayReport = dateRange && dateRange.start === dateRange.end;

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
  let closingCardTotal = 0;
  let profit = 0;
  let openingBankBalances: Array<{
    bankAccountId: string;
    bankName: string;
    accountNumber: string;
    balance: number;
  }> = [];

  // Create date objects for filtering (must be declared before use)
  const startDateObj = new Date(startDate);
  startDateObj.setHours(0, 0, 0, 0);
  const endDateObj = new Date(endDate);
  endDateObj.setHours(23, 59, 59, 999);

  // Get opening balance additions from date range report
  let openingBalanceAdditions = dateRangeReport?.openingBalanceAdditions || [];

  // Filter opening balance additions by date range to ensure only selected dates are shown
  if (openingBalanceAdditions.length > 0) {
    openingBalanceAdditions = openingBalanceAdditions.filter((add: any) => {
      const addDate = add.time || add.date || add.createdAt;
      if (!addDate) return false;
      
      const addDateObj = new Date(addDate);
      const addYear = addDateObj.getFullYear();
      const addMonth = addDateObj.getMonth();
      const addDay = addDateObj.getDate();
      const addLocalDate = new Date(addYear, addMonth, addDay);
      
      return addLocalDate.getTime() >= startDateObj.getTime() && 
             addLocalDate.getTime() <= endDateObj.getTime();
    });
  }

  // Calculate total additional balance (opening balance additions)
  const totalAdditionalBalance = openingBalanceAdditions.reduce(
    (sum: number, add: any) => sum + Number(add.amount || 0),
    0
  );

  if (isUsingBackendData && dateRangeReport) {
    // For single day reports, use the first daily report from the date range
    // For multi-day reports, aggregate all daily reports
    const dailyReports = dateRangeReport.dailyReports || [];
    const reportToUse = isSingleDayReport && dailyReports.length > 0 
      ? dailyReports[0] 
      : null;
    
    if (reportToUse) {
      // Single day report - use the daily report data
      filteredSales = reportToUse.sales?.items || [];
      filteredExpenses = (reportToUse.expenses?.items || []).filter((expense: any) => {
        const expenseDate = new Date(expense.date);
        expenseDate.setHours(0, 0, 0, 0);
        return expenseDate.getTime() >= startDateObj.getTime() && expenseDate.getTime() <= endDateObj.getTime();
      });
      filteredPurchases = (reportToUse.purchases?.items || []).filter((purchase: any) => {
        if (purchase.payments?.length > 0) {
          return purchase.payments.some((payment: any) => {
            const paymentDate = payment.date ? new Date(payment.date) : new Date(purchase.date);
            paymentDate.setHours(0, 0, 0, 0);
            return paymentDate.getTime() >= startDateObj.getTime() && paymentDate.getTime() <= endDateObj.getTime();
          });
        }
        const purchaseDate = new Date(purchase.date);
        purchaseDate.setHours(0, 0, 0, 0);
        return purchaseDate.getTime() >= startDateObj.getTime() && purchaseDate.getTime() <= endDateObj.getTime();
      });
      totalSales = reportToUse.sales?.total || 0;
      totalExpenses = reportToUse.expenses?.total || 0;
      totalPurchases = reportToUse.purchases?.total || 0;
      openingBalance = reportToUse.openingBalance?.total || 0;
      openingCash = reportToUse.openingBalance?.cash || 0;
      const openingBanks = (reportToUse.openingBalance as any)?.banks || [];
      openingBankTotal = openingBanks.reduce(
        (sum: number, bank: any) => sum + Number(bank.balance || 0),
        0
      );
      openingBankBalances = openingBanks.map((bank: any) => ({
        bankAccountId: bank.bankAccountId,
        bankName: bank.bankName || "Unknown",
        accountNumber: bank.accountNumber || "",
        balance: Number(bank.balance || 0),
      }));

      closingBalance = reportToUse.closingBalance?.total || 0;
      closingCash = reportToUse.closingBalance?.cash || 0;
      const closingBanks = (reportToUse.closingBalance as any)?.banks || [];
      closingBankTotal = closingBanks.reduce(
        (sum: number, bank: any) => sum + Number(bank.balance || 0),
        0
      );
      const closingCards = (reportToUse.closingBalance as any)?.cards || [];
      closingCardTotal = closingCards.reduce(
        (sum: number, card: any) => sum + Number(card.balance || 0),
        0
      );

      profit = totalSales - totalExpenses - totalPurchases;
    } else if (isUsingBackendData && dateRangeReport) {
      // Backend now returns filtered records based on payment dates
      // Backend returns sales, purchases, expenses as objects with items array
      filteredSales = dateRangeReport.sales?.items || [];
      filteredPurchases = dateRangeReport.purchases?.items || [];
      filteredExpenses = dateRangeReport.expenses?.items || [];

      // Calculate totals from aggregated data (use dailyReports totals which are more accurate)
      // First try to sum from dailyReports, then fallback to summary or calculate from items
      const calculatedSalesTotal =
        dateRangeReport.dailyReports?.reduce(
          (sum: number, dr: any) => sum + (dr.sales?.total || 0),
          0
        ) || 0;
      const calculatedPurchasesTotal =
        dateRangeReport.dailyReports?.reduce(
          (sum: number, dr: any) => sum + (dr.purchases?.total || 0),
          0
        ) || 0;
      const calculatedExpensesTotal =
        dateRangeReport.dailyReports?.reduce(
          (sum: number, dr: any) => sum + (dr.expenses?.total || 0),
          0
        ) || 0;

      totalSales =
        calculatedSalesTotal ||
        dateRangeReport.summary?.sales?.total ||
        filteredSales.reduce(
          (sum: number, sale: any) =>
            sum + Number(sale.paymentAmount || sale.total || 0),
          0
        );
      totalExpenses =
        calculatedExpensesTotal ||
        dateRangeReport.summary?.expenses?.total ||
        filteredExpenses.reduce(
          (sum: number, expense: any) => sum + Number(expense.amount || 0),
          0
        );
      totalPurchases =
        calculatedPurchasesTotal ||
        dateRangeReport.summary?.purchases?.total ||
        filteredPurchases.reduce(
          (sum: number, purchase: any) =>
            sum + Number(purchase.paymentAmount || purchase.total || 0),
          0
        );

      // For opening balance, use first daily report's opening balance
      const firstDailyReport = dateRangeReport.dailyReports?.[0];
      openingBalance =
        firstDailyReport?.openingBalance?.total ||
        dateRangeReport.summary?.openingBalance?.total ||
        0;
      openingCash =
        firstDailyReport?.openingBalance?.cash ||
        dateRangeReport.summary?.openingBalance?.cash ||
        0;
      // For date range report, get banks from summary openingBalance.banks
      const summaryOpeningBanks =
        (dateRangeReport.summary?.openingBalance as any)?.banks || [];
      if (summaryOpeningBanks.length > 0) {
        openingBankTotal = summaryOpeningBanks.reduce(
          (sum: number, bank: any) => sum + Number(bank.balance || 0),
          0
        );
        openingBankBalances = summaryOpeningBanks.map((bank: any) => ({
          bankAccountId: bank.bankAccountId,
          bankName: bank.bankName || "Unknown",
          accountNumber: bank.accountNumber || "",
          balance: Number(bank.balance || 0),
        }));
      } else {
        // Fallback: check first daily report if available
        const firstDailyReport = dateRangeReport.dailyReports?.[0];
        if (firstDailyReport?.openingBalance?.banks) {
          const openingBanks = firstDailyReport.openingBalance.banks || [];
          openingBankTotal = openingBanks.reduce(
            (sum: number, bank: any) => sum + Number(bank.balance || 0),
            0
          );
          openingBankBalances = openingBanks.map((bank: any) => ({
            bankAccountId: bank.bankAccountId,
            bankName: bank.bankName || "Unknown",
            accountNumber: bank.accountNumber || "",
            balance: Number(bank.balance || 0),
          }));
        } else {
          // Fallback to cards if banks not available (legacy)
          openingBankTotal = dateRangeReport.summary?.openingBalance?.cards || 0;
        }
      }
      // Calculate closing balance from last daily report or use summary
      const lastDailyReport =
        dateRangeReport.dailyReports && dateRangeReport.dailyReports.length > 0
          ? dateRangeReport.dailyReports[dateRangeReport.dailyReports.length - 1]
          : null;

      closingBalance =
        lastDailyReport?.closingBalance?.total ||
        dateRangeReport.summary?.closingBalance?.total ||
        0;
      closingCash =
        lastDailyReport?.closingBalance?.cash ||
        dateRangeReport.summary?.closingBalance?.cash ||
        0;

      // For date range report, get closing bank balance from last daily report or summary
      if (
        lastDailyReport?.closingBalance?.banks &&
        lastDailyReport.closingBalance.banks.length > 0
      ) {
        const closingBanks = lastDailyReport.closingBalance.banks || [];
        closingBankTotal = closingBanks.reduce(
          (sum: number, bank: any) => sum + Number(bank.balance || 0),
          0
        );
      } else {
        const summaryClosingBanks =
          (dateRangeReport.summary?.closingBalance as any)?.banks || [];
        if (summaryClosingBanks.length > 0) {
          closingBankTotal = summaryClosingBanks.reduce(
            (sum: number, bank: any) => sum + Number(bank.balance || 0),
            0
          );
        } else {
          // Fallback to cards if banks not available (legacy)
          closingBankTotal = dateRangeReport.summary?.closingBalance?.cards || 0;
        }
      }

      // Calculate closing card balance from last daily report or summary
      if (
        lastDailyReport?.closingBalance?.cards &&
        lastDailyReport.closingBalance.cards.length > 0
      ) {
        const closingCards = lastDailyReport.closingBalance.cards || [];
        closingCardTotal = closingCards.reduce(
          (sum: number, card: any) => sum + Number(card.balance || 0),
          0
        );
      } else {
        const summaryClosingCards =
          (dateRangeReport.summary?.closingBalance as any)?.cards || [];
        if (summaryClosingCards.length > 0) {
          closingCardTotal = summaryClosingCards.reduce(
            (sum: number, card: any) => sum + Number(card.balance || 0),
            0
          );
        }
      }
      profit = totalSales - totalExpenses - totalPurchases;
  } else if (dateRange) {
    // Fallback to frontend data
    filteredSales = getSalesByDateRange(dateRange.start, dateRange.end) || [];
    filteredExpenses =
      getExpensesByDateRange(dateRange.start, dateRange.end) || [];
    totalSales = filteredSales.reduce(
      (sum, s) => sum + Number(s?.total || 0),
      0
    );
    totalExpenses = filteredExpenses.reduce(
      (sum, e) => sum + Number(e?.amount || 0),
      0
    );
    profit = totalSales - totalExpenses;
    closingBalance = profit;
    closingCash = profit;
  }

  // Map bank balances from previous day balance (only if not already set from report)
  if (previousDayBalance && bankAccounts && openingBankBalances.length === 0) {
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
    openingBankTotal = openingBankBalances.reduce(
      (sum, b) => sum + (b.balance || 0),
      0
    );
  }

  // Group sales by customer for combined totals
  const customerSalesMap = new Map<
    string,
    { customerName: string; total: number; bills: string[]; count: number }
  >();
  // Ensure filteredSales is an array before calling forEach
  if (Array.isArray(filteredSales)) {
    filteredSales.forEach((sale) => {
      if (!sale || !sale.id) return;
      const customerName = sale.customerName || "Walk-in";
      // For expanded payment rows, use paymentAmount if available, otherwise total
      const saleTotal = Number(sale.paymentAmount || sale.total || 0);

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
  }

  // Customer totals calculation (kept for potential future use)
  // const customerTotals = Array.from(customerSalesMap.values())
  //   .filter((item) => item.count > 1)
  //   .sort((a, b) => b.total - a.total);

  const exportToPDF = async () => {
    if (!dateRange) return;

    // For single day reports, use backend PDF generation
    if (isSingleDayReport && dateRangeReport) {
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

    // Fetch all balance transactions for the date range to get before/after balances
    let allBalanceTransactions: any[] = [];
    try {
      const transactionsResponse = await api.getTransactions({
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      // Ensure it's an array
      allBalanceTransactions = Array.isArray(transactionsResponse)
        ? transactionsResponse
        : transactionsResponse?.data || [];
      // Sort by creation time
      if (Array.isArray(allBalanceTransactions)) {
        allBalanceTransactions.sort(
          (a: any, b: any) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }
    } catch (e) {
      console.error("Error fetching balance transactions for print:", e);
      allBalanceTransactions = [];
    }

    // Create a map of balance transactions by source, sourceId, and paymentType
    const balanceTxMap = new Map<string, any[]>();
    // Ensure allBalanceTransactions is an array before iterating
    if (Array.isArray(allBalanceTransactions)) {
      allBalanceTransactions.forEach((tx: any) => {
        if (tx && typeof tx === "object") {
          const key = `${tx.source || ""}_${tx.sourceId || ""}_${
            tx.paymentType || "cash"
          }`;
          if (!balanceTxMap.has(key)) {
            balanceTxMap.set(key, []);
          }
          balanceTxMap.get(key)!.push(tx);
        }
      });
    }

    // Build comprehensive chronological report for print
    const reportsToProcess = dateRangeReport?.dailyReports || [];

    // If no reports to process, show error
    if (!reportsToProcess || reportsToProcess.length === 0) {
      showError("No report data available to print. Please ensure the report is loaded.");
      return;
    }

    let printContent = "";

    reportsToProcess.forEach((report: any, reportIdx: number) => {
      const reportDate = report.date || dateRange?.start || "";

      // Calculate opening bank total once per report
      const openingBankTotal =
        report.openingBalance?.banks?.reduce(
          (sum: number, bank: any) => sum + Number(bank.balance || 0),
          0
        ) || 0;

      printContent += `<h2>Date: ${new Date(reportDate).toLocaleDateString(
        "en-US",
        {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }
      )}</h2>`;

      // Opening Balance - Simple header before transaction table
      printContent += `<div style="margin-bottom: 15px;">
        <p style="font-size: 12px; color: #6b7280; margin: 5px 0;"><strong>Opening Balance:</strong> Cash: ${formatCompleteAmount(
          report.openingBalance?.cash || 0
        )}, Bank: ${formatCompleteAmount(openingBankTotal)}, Total: ${formatCompleteAmount(
        report.openingBalance?.total || 0
      )}</p>
      </div>`;

      // Build chronological transaction table
      const allTransactions: any[] = [];

      // Add opening balance additions
      if (
        report.openingBalanceAdditions &&
        report.openingBalanceAdditions.length > 0
      ) {
        report.openingBalanceAdditions.forEach((add: any) => {
          const addDateTime = add.time
            ? new Date(add.time)
            : add.date
            ? new Date(add.date)
            : new Date(reportDate);
          allTransactions.push({
            type: "Additional Balance",
            datetime: addDateTime,
            date: add.date || add.time || reportDate,
            time: add.time || new Date(add.date || reportDate).toTimeString(),
            paymentType: add.paymentType,
            amount: Number(add.amount || 0),
            beforeBalance: add.beforeBalance,
            afterBalance: add.afterBalance,
            description: add.description || "Opening Balance Addition",
            bankName: add.bankAccount?.bankName || "",
          });
        });
      }

      // Add purchases with balance transaction data
      if (report.purchases?.items && report.purchases.items.length > 0) {
        report.purchases.items.forEach((purchase: any) => {
          const payments = (purchase.payments as Array<any> | null) || [];
          if (payments.length > 0) {
            payments.forEach((p: any, idx: number) => {
              const paymentDate = p.date || purchase.date || purchase.createdAt;
              const paymentDateTime = new Date(paymentDate);
              const key = `purchase_payment_${purchase.id}_${p.type || "cash"}`;
              let balanceTxs = balanceTxMap.get(key) || [];
              if (balanceTxs.length === 0) {
                const key2 = `purchase_${purchase.id}_${p.type || "cash"}`;
                balanceTxs = balanceTxMap.get(key2) || [];
              }
              const balanceTx =
                balanceTxs.length > idx
                  ? balanceTxs[idx]
                  : balanceTxs.length > 0
                  ? balanceTxs[0]
                  : null;

              allTransactions.push({
                type: "Purchase",
                datetime: paymentDateTime,
                date: paymentDate,
                time: paymentDateTime.toLocaleTimeString(),
                paymentType: p.type || "cash",
                amount: Number(p.amount || 0),
                beforeBalance:
                  balanceTx?.beforeBalance !== null &&
                  balanceTx?.beforeBalance !== undefined
                    ? Number(balanceTx.beforeBalance)
                    : null,
                afterBalance:
                  balanceTx?.afterBalance !== null &&
                  balanceTx?.afterBalance !== undefined
                    ? Number(balanceTx.afterBalance)
                    : null,
                description: `Purchase - ${purchase.supplierName || "N/A"}`,
                bankName: p.bankAccountId ? "Bank Transfer" : "",
              });
            });
          } else {
            const purchaseDate = purchase.date || purchase.createdAt;
            const purchaseDateTime = new Date(purchaseDate);
            const key = `purchase_${purchase.id}_${
              purchase.paymentType || "cash"
            }`;
            const balanceTxs = balanceTxMap.get(key) || [];
            const balanceTx = balanceTxs.length > 0 ? balanceTxs[0] : null;

            allTransactions.push({
              type: "Purchase",
              datetime: purchaseDateTime,
              date: purchaseDate,
              time: purchaseDateTime.toLocaleTimeString(),
              paymentType: purchase.paymentType || "cash",
              amount: Number(purchase.total || 0),
              beforeBalance:
                balanceTx?.beforeBalance !== null &&
                balanceTx?.beforeBalance !== undefined
                  ? Number(balanceTx.beforeBalance)
                  : null,
              afterBalance:
                balanceTx?.afterBalance !== null &&
                balanceTx?.afterBalance !== undefined
                  ? Number(balanceTx.afterBalance)
                  : null,
              description: `Purchase - ${purchase.supplierName || "N/A"}`,
            });
          }
        });
      }

      // Add sales with balance transaction data
      if (report.sales?.items && report.sales.items.length > 0) {
        report.sales.items.forEach((sale: any) => {
          const payments = (sale.payments as Array<any> | null) || [];
          if (payments.length > 0) {
            payments.forEach((p: any, idx: number) => {
              const paymentDate = p.date || sale.date || sale.createdAt;
              const paymentDateTime = new Date(paymentDate);
              const key = `sale_payment_${sale.id}_${p.type || "cash"}`;
              let balanceTxs = balanceTxMap.get(key) || [];
              if (balanceTxs.length === 0) {
                const key2 = `sale_${sale.id}_${p.type || "cash"}`;
                balanceTxs = balanceTxMap.get(key2) || [];
              }
              const balanceTx =
                balanceTxs.length > idx
                  ? balanceTxs[idx]
                  : balanceTxs.length > 0
                  ? balanceTxs[0]
                  : null;

              allTransactions.push({
                type: "Sale",
                datetime: paymentDateTime,
                date: paymentDate,
                time: paymentDateTime.toLocaleTimeString(),
                paymentType: p.type || "cash",
                amount: Number(p.amount || 0),
                beforeBalance:
                  balanceTx?.beforeBalance !== null &&
                  balanceTx?.beforeBalance !== undefined
                    ? Number(balanceTx.beforeBalance)
                    : null,
                afterBalance:
                  balanceTx?.afterBalance !== null &&
                  balanceTx?.afterBalance !== undefined
                    ? Number(balanceTx.afterBalance)
                    : null,
                description: `Sale - Bill #${sale.billNumber || "N/A"} - ${
                  sale.customerName || "Walk-in"
                }`,
                bankName: p.bankAccountId ? "Bank Transfer" : "",
              });
            });
          } else {
            const saleDate = sale.date || sale.createdAt;
            const saleDateTime = new Date(saleDate);
            const key = `sale_${sale.id}_${sale.paymentType || "cash"}`;
            const balanceTxs = balanceTxMap.get(key) || [];
            const balanceTx = balanceTxs.length > 0 ? balanceTxs[0] : null;

            allTransactions.push({
              type: "Sale",
              datetime: saleDateTime,
              date: saleDate,
              time: saleDateTime.toLocaleTimeString(),
              paymentType: sale.paymentType || "cash",
              amount: Number(sale.total || 0),
              beforeBalance:
                balanceTx?.beforeBalance !== null &&
                balanceTx?.beforeBalance !== undefined
                  ? Number(balanceTx.beforeBalance)
                  : null,
              afterBalance:
                balanceTx?.afterBalance !== null &&
                balanceTx?.afterBalance !== undefined
                  ? Number(balanceTx.afterBalance)
                  : null,
              description: `Sale - Bill #${sale.billNumber || "N/A"} - ${
                sale.customerName || "Walk-in"
              }`,
            });
          }
        });
      }

      // Add expenses with balance transaction data
      if (report.expenses?.items && report.expenses.items.length > 0) {
        report.expenses.items.forEach((expense: any) => {
          const expenseDate = expense.date || expense.createdAt;
          const expenseDateTime = new Date(expenseDate);
          const key = `expense_${expense.id}_${expense.paymentType || "cash"}`;
          const balanceTxs = balanceTxMap.get(key) || [];
          const balanceTx = balanceTxs.length > 0 ? balanceTxs[0] : null;

          allTransactions.push({
            type: "Expense",
            datetime: expenseDateTime,
            date: expenseDate,
            time: expenseDateTime.toLocaleTimeString(),
            paymentType: expense.paymentType || "cash",
            amount: Number(expense.amount || 0),
            beforeBalance:
              balanceTx?.beforeBalance !== null &&
              balanceTx?.beforeBalance !== undefined
                ? Number(balanceTx.beforeBalance)
                : null,
            afterBalance:
              balanceTx?.afterBalance !== null &&
              balanceTx?.afterBalance !== undefined
                ? Number(balanceTx.afterBalance)
                : null,
            description: expense.description || expense.category || "Expense",
            bankName: expense.bankAccountId ? "Bank Transfer" : "",
          });
        });
      }

      // Sort all transactions by datetime
      allTransactions.sort((a, b) => {
        const dateTimeA = a.datetime
          ? a.datetime.getTime()
          : new Date(a.date).getTime();
        const dateTimeB = b.datetime
          ? b.datetime.getTime()
          : new Date(b.date).getTime();
        return dateTimeA - dateTimeB;
      });

      // Create chronological table matching opening balance design
      if (allTransactions.length > 0) {
        printContent += `<h3 style="margin-top: 20px; margin-bottom: 15px; font-size: 16px; font-weight: bold;">Chronological Transaction Details</h3>`;
        printContent += `<table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 11px;">`;
        printContent += `<thead><tr style="background-color: #f3f4f6; border-bottom: 2px solid #d1d5db;">
          <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-weight: 600;">Time</th>
          <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-weight: 600;">Type</th>
          <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-weight: 600;">Source</th>
          <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-weight: 600;">Description</th>
          <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-weight: 600;">Payment Type</th>
          <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-weight: 600;">Bank</th>
          <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: 600;">Before Balance</th>
          <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: 600;">Change</th>
          <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: 600;">After Balance</th>
        </tr></thead><tbody>`;

        // Helper function to get source label
        const getSourceLabel = (type: string) => {
          const labels: Record<string, string> = {
            Sale: "Sale Payment",
            Purchase: "Purchase Payment",
            Expense: "Expense Payment",
            "Additional Balance": "Add to Opening Balance",
          };
          return labels[type] || type;
        };

        // Helper function to format currency - use complete amount with commas
        const formatCurrency = (amount: number) => {
          return formatCompleteAmount(amount);
        };

        allTransactions.forEach((tran) => {
          const isIncome =
            tran.type === "Sale" || tran.type === "Additional Balance";
          const dateTime =
            tran.datetime || (tran.date ? new Date(tran.date) : new Date());

          // Determine row background color based on income/expense
          const rowBgColor = isIncome ? "#f0fdf4" : "#fef2f2"; // green-50 or red-50
          const typeBadgeColor = isIncome ? "#dcfce7" : "#fee2e2"; // green-200 or red-200
          const typeTextColor = isIncome ? "#166534" : "#991b1b"; // green-800 or red-800
          const amountColor = isIncome ? "#16a34a" : "#dc2626"; // green-600 or red-600

          printContent += `<tr style="background-color: ${rowBgColor}; border-bottom: 1px solid #e5e7eb;">
            <td style="border: 1px solid #e5e7eb; padding: 8px; white-space: nowrap;">${dateTime.toLocaleString(
              "en-US",
              {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }
            )}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px;">
              <span style="background-color: ${typeBadgeColor}; color: ${typeTextColor}; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">
                ${isIncome ? "Income" : "Expense"}
              </span>
            </td>
            <td style="border: 1px solid #e5e7eb; padding: 8px;">${getSourceLabel(
              tran.type
            )}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${
              tran.description || "-"
            }</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-transform: capitalize;">${
              tran.paymentType === "cash"
                ? "Cash"
                : tran.paymentType === "card"
                ? "Card"
                : "Bank Transfer"
            }</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; font-size: 10px;">${
              tran.bankName || "-"
            }</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">${
              tran.beforeBalance !== null && tran.beforeBalance !== undefined
                ? formatCurrency(Number(tran.beforeBalance))
                : "-"
            }</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; color: ${amountColor}; font-weight: 600;">
              ${isIncome ? "+" : "-"}${formatCurrency(tran.amount)}
            </td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">${
              tran.afterBalance !== null && tran.afterBalance !== undefined
                ? formatCurrency(Number(tran.afterBalance))
                : "-"
            }</td>
          </tr>`;
        });

        printContent += `</tbody></table>`;
      }

      // Summary - Simple table format matching date-wise financial flow design
      const additionalTotal =
        report.openingBalanceAdditions?.reduce(
          (sum: number, add: any) =>
            sum +
            (add.type === "expense"
              ? -Number(add.amount || 0)
              : Number(add.amount || 0)),
          0
        ) || 0;
      const closingBankTotal =
        report.closingBalance?.banks?.reduce(
          (sum: number, bank: any) => sum + Number(bank.balance || 0),
          0
        ) || 0;
      // Reuse openingBankTotal calculated at the start of the loop

      printContent += `<h3 style="margin-top: 20px; margin-bottom: 10px; font-size: 16px; font-weight: bold;">Summary</h3>`;
      printContent += `<table style="width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 11px;">
        <thead>
          <tr style="background-color: #f3f4f6; border-bottom: 2px solid #d1d5db;">
            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-weight: 600;">Description</th>
            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: 600;">Cash (Rs.)</th>
            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: 600;">Bank (Rs.)</th>
            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: 600;">Card (Rs.)</th>
            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: 600;">Total (Rs.)</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background-color: #dbeafe; border-bottom: 1px solid #e5e7eb;">
            <td style="border: 1px solid #e5e7eb; padding: 8px; font-weight: 600;">Opening Balance</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #2563eb;">${formatCompleteAmount(
              report.openingBalance?.cash || 0
            )}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #2563eb;">${formatCompleteAmount(
              openingBankTotal
            )}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #2563eb;">${formatCompleteAmount(
              report.openingBalance?.cards?.reduce(
                (s: number, c: any) => s + (c.balance || 0),
                0
              ) || 0
            )}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #2563eb;">${formatCompleteAmount(
              report.openingBalance?.total || 0
            )}</td>
          </tr>`;

      if (additionalTotal !== 0) {
        const additionalCash =
          report.openingBalanceAdditions
            ?.filter((add: any) => add.paymentType === "cash")
            .reduce(
              (sum: number, add: any) =>
                sum +
                (add.type === "expense"
                  ? -Number(add.amount || 0)
                  : Number(add.amount || 0)),
              0
            ) || 0;
        const additionalBank = additionalTotal - additionalCash;
        printContent += `
          <tr style="background-color: #f3e8ff; border-bottom: 1px solid #e5e7eb;">
            <td style="border: 1px solid #e5e7eb; padding: 8px; font-weight: 600;">Opening Balance Additions</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #9333ea;">${formatCompleteAmount(
              additionalCash
            )}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #9333ea;">${formatCompleteAmount(
              additionalBank
            )}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #9333ea;">0</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #9333ea;">${formatCompleteAmount(
              additionalTotal
            )}</td>
          </tr>`;
      }

      printContent += `
          <tr style="background-color: #d1fae5; border-bottom: 1px solid #e5e7eb;">
            <td style="border: 1px solid #e5e7eb; padding: 8px; font-weight: 600;">Sales</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #16a34a;">${formatCompleteAmount(
              report.sales?.cash || 0
            )}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #16a34a;">${formatCompleteAmount(
              report.sales?.bank_transfer || 0
            )}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #16a34a;">${formatCompleteAmount(
              report.sales?.card || 0
            )}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #16a34a;">${formatCompleteAmount(
              report.sales?.total || 0
            )}</td>
          </tr>
          <tr style="background-color: #fed7aa; border-bottom: 1px solid #e5e7eb;">
            <td style="border: 1px solid #e5e7eb; padding: 8px; font-weight: 600;">Purchases</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #ea580c;">-${formatCompleteAmount(
              report.purchases?.cash || 0
            )}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #ea580c;">-${formatCompleteAmount(
              report.purchases?.bank_transfer || 0
            )}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #ea580c;">-${formatCompleteAmount(
              report.purchases?.card || 0
            )}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #ea580c;">-${formatCompleteAmount(
              report.purchases?.total || 0
            )}</td>
          </tr>
          <tr style="background-color: #fee2e2; border-bottom: 1px solid #e5e7eb;">
            <td style="border: 1px solid #e5e7eb; padding: 8px; font-weight: 600;">Expenses</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #dc2626;">-${formatCompleteAmount(
              report.expenses?.cash || 0
            )}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #dc2626;">-${formatCompleteAmount(
              report.expenses?.bank_transfer || 0
            )}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #dc2626;">-${formatCompleteAmount(
              report.expenses?.card || 0
            )}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #dc2626;">-${formatCompleteAmount(
              report.expenses?.total || 0
            )}</td>
          </tr>
          <tr style="background-color: #e0e7ff; border-top: 2px solid #6366f1; border-bottom: 2px solid #6366f1;">
            <td style="border: 1px solid #e5e7eb; padding: 8px; font-weight: bold; font-size: 12px;">Closing Balance</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: bold; font-size: 12px; color: #4f46e5;">${formatCompleteAmount(
              report.closingBalance?.cash || 0
            )}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: bold; font-size: 12px; color: #4f46e5;">${formatCompleteAmount(
              closingBankTotal
            )}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: bold; font-size: 12px; color: #4f46e5;">${formatCompleteAmount(
              closingCardTotal
            )}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: bold; font-size: 12px; color: #4f46e5;">${formatCompleteAmount(
              report.closingBalance?.total || 0
            )}</td>
          </tr>
        </tbody>
      </table>`;

      if (reportIdx < reportsToProcess.length - 1) {
        printContent += `<div style="page-break-after: always;"></div>`;
      }
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Report - ${dateRange.start}${
      dateRange.start !== dateRange.end ? ` to ${dateRange.end}` : ""
    }</title>
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
          <p><strong>Date Range:</strong> ${dateRange.start}${
      dateRange.start !== dateRange.end ? ` to ${dateRange.end}` : ""
    }</p>
          ${printContent}
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
    <div>
      <PageMeta
        title="Reports & Analysis | Isma Sports Complex"
        description="View sales, expenses and profit reports"
      />
      <div className="mb-6" ref={printRef}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 no-print">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
            Reports & Analysis
          </h1>
          <div className="flex gap-2 w-full sm:w-auto">
            <Link to="/reports/opening-balance" className="flex-1 sm:flex-none">
              <Button size="sm" variant="outline" className="w-full sm:w-auto">
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
                <span className="hidden sm:inline">Add Opening Balance</span>
                <span className="sm:hidden">Add Balance</span>
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2 no-print">
          <div>
            <Label>Start Date</Label>
            <DatePicker
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              max={getTodayDate()}
            />
          </div>
          <div>
            <Label>End Date</Label>
            <DatePicker
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              max={getTodayDate()}
            />
          </div>
        </div>

        {dateRange && loading ? (
          <div className="text-center py-8 mb-6">
            <p className="text-gray-500">Loading report data...</p>
          </div>
        ) : (
          <div>
            {/* Previous Day Balance Section - Only for single day reports */}
            {isSingleDayReport && previousDayBalance && (
              <div className="mb-6 p-4 sm:p-6 bg-gray-50 dark:bg-gray-900/20 rounded-lg border-2 border-gray-200 dark:border-gray-800">
                <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white mb-3 sm:mb-4">
                  Previous Day Closing Balance (Opening Balance)
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 sm:p-4 border border-blue-200 dark:border-blue-800">
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Cash Balance
                    </p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600 price-responsive">
                      {formatCompleteAmount(
                        Number(previousDayBalance.cashBalance || 0)
                      )}
                    </p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 sm:p-4 border border-green-200 dark:border-green-800">
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Total Bank Balance
                    </p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600 price-responsive">
                      {formatCompleteAmount(
                        Number(
                          previousDayBalance.bankBalances?.reduce(
                            (sum, b) => sum + Number(b.balance || 0),
                            0
                          ) || 0
                        )
                      )}
                    </p>
                  </div>
                </div>
                {openingBankBalances.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                      Bank-wise Balances:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {openingBankBalances.map((bank) => (
                        <div
                          key={bank.bankAccountId}
                          className="bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-700"
                        >
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {bank.bankName}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {bank.accountNumber}
                          </p>
                          <p className="text-xs sm:text-sm font-bold text-gray-800 dark:text-white price-responsive">
                            {formatCompleteAmount(Number(bank.balance || 0))}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-3 sm:gap-4 mb-6 sm:grid-cols-2 md:grid-cols-4 no-print">
              {isUsingBackendData && (
                <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    Opening Balance
                  </p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600 dark:text-blue-400 price-responsive">
                    {formatCompleteAmount(openingBalance)}
                  </p>
                  {(openingCash > 0 || openingBankTotal > 0) && (
                    <div className="mt-2 text-xs text-gray-500">
                      <div>Cash: {formatCompleteAmount(openingCash)}</div>
                      {openingBankTotal > 0 && (
                        <div>Bank: {formatCompleteAmount(openingBankTotal)}</div>
                      )}
                    </div>
                  )}
                  {openingBankBalances.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500 space-y-1">
                      {openingBankBalances.map((bank) => (
                        <div key={bank.bankAccountId}>
                          {bank.bankName}: {formatCompleteAmount(bank.balance)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  Total Sales
                </p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600 dark:text-green-400 price-responsive">
                  {formatCompleteAmount(totalSales)}
                </p>
              </div>
              <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  Total Purchases
                </p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-600 dark:text-orange-400 price-responsive">
                  {formatCompleteAmount(totalPurchases)}
                </p>
              </div>
              {isUsingBackendData && totalAdditionalBalance > 0 && (
                <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                  <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                    Total Additional Balance
                  </p>
                  <p className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-600 dark:text-purple-400 price-responsive">
                    {formatCompleteAmount(totalAdditionalBalance)}
                  </p>
                </div>
              )}
              <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  Total Expenses
                </p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-red-600 dark:text-red-400 price-responsive">
                  {formatCompleteAmount(totalExpenses)}
                </p>
              </div>
              <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  {isUsingBackendData ? "Closing Balance" : "Profit/Loss"}
                </p>
                <p
                  className={`text-lg sm:text-xl lg:text-2xl font-bold price-responsive ${
                    (isUsingBackendData ? closingBalance : profit) >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {formatCompleteAmount(
                    isUsingBackendData ? closingBalance : profit
                  )}
                </p>
                {isUsingBackendData &&
                (closingCash > 0 || closingBankTotal > 0) ? (
                  <div className="mt-2 text-xs text-gray-500">
                    <div>Cash: {formatCompleteAmount(closingCash)}</div>
                    {closingBankTotal > 0 && (
                      <div>Bank: {formatCompleteAmount(closingBankTotal)}</div>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  Total Bills
                </p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-800 dark:text-white">
                  {filteredSales.length}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 flex gap-2 no-print flex-wrap">
          <Button onClick={exportToPDF} size="sm">
            <DownloadIcon className="w-4 h-4 mr-2" />
            Print / PDF
          </Button>
        </div>

        {/* Chronological Transaction List - Primary View Based on Payment Dates */}
        {isUsingBackendData &&
          ((dateRangeReport?.transactions &&
            dateRangeReport.transactions.length > 0) ||
            (dailyReport &&
              (dailyReport.sales?.items?.length > 0 ||
                dailyReport.purchases?.items?.length > 0 ||
                dailyReport.expenses?.items?.length > 0 ||
                (dailyReport.openingBalanceAdditions && dailyReport.openingBalanceAdditions.length > 0)))) && (
            <div className="mb-6 p-3 sm:p-4 md:p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
              <h2 className="mb-4 text-lg sm:text-xl font-semibold text-gray-800 dark:text-white">
                📅 All Transactions (Ordered by Payment Date/Time)
              </h2>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Shows each payment as it occurred, based on the payment date
                inside the payments array
              </div>
              <div className="table-container">
                <table className="responsive-table text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="p-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[180px]">
                        Date & Time
                      </th>
                      <th className="p-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[80px]">
                        Type
                      </th>
                      <th className="p-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[120px]">
                        Source
                      </th>
                      <th className="p-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[150px]">
                        Description
                      </th>
                      <th className="p-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[100px]">
                        Payment Type
                      </th>
                      <th className="p-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[80px]">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {chronologicalTransactions.map(
                      (transaction: any, index: number) => {
                        // Determine if transaction is income or expense
                        // Use transactionType if available (from backend), otherwise infer from type name
                        const isIncome = transaction.transactionType === "income" || 
                          (transaction.transactionType === undefined && (
                            transaction.type === "Sale" ||
                            transaction.type === "Balance Add" ||
                            transaction.type === "Opening Balance Addition" ||
                            transaction.type === "Purchase Refund"
                          ));
                        return (
                          <tr
                            key={`${
                              transaction.type
                            }-${transaction.datetime.getTime()}-${index}`}
                            className={`border-b border-gray-100 dark:border-gray-700 ${
                              index % 2 === 0
                                ? isIncome
                                  ? "bg-green-50 dark:bg-green-900/10"
                                  : "bg-red-50 dark:bg-red-900/10"
                                : ""
                            }`}
                          >
                            <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {(() => {
                                const dateInput = transaction.datetime || transaction.date;
                                if (!dateInput) return "-";
                                
                                // Parse UTC date string without timezone conversion
                                const dt = parseUTCDateString(dateInput);
                                if (!dt || isNaN(dt.getTime())) {
                                  return "-";
                                }
                                
                                // Format: Date and Time using the correctly parsed date
                                const dateStr = dt.toLocaleDateString("en-US", {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                });
                                const timeStr = dt.toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                  hour12: true,
                                });
                                return `${dateStr} ${timeStr}`;
                              })()}
                            </td>
                            <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {transaction.type}
                            </td>
                            <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {transaction.source || "-"}
                            </td>
                            <td className="p-2 text-gray-700 dark:text-gray-300 max-w-[150px] truncate">
                              {transaction.description || ""}
                            </td>
                            <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {transaction.paymentType || "cash"}
                            </td>
                            <td
                              className={`p-2 text-right font-semibold whitespace-nowrap ${
                                isIncome
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {isIncome ? "+" : "-"}
                              {formatCompleteAmount(Math.abs(transaction.amount || 0))}
                            </td>
                          </tr>
                        );
                      }
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        {/* Date-wise Financial Flow - For Daily, Custom Range, Weekly/Monthly */}
        {isUsingBackendData &&
          (dateRangeReport &&
            (dateRangeReport &&
              dateRangeReport.dailyReports &&
              dateRangeReport.dailyReports.length > 0)) && (
            <div className="mb-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
              <button
                onClick={() =>
                  setIsDateWiseFlowExpanded(!isDateWiseFlowExpanded)
                }
                className="w-full p-4 sm:p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-t-lg"
              >
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800 dark:text-white">
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
                <div
                  className={`p-3 sm:p-4 md:p-6 pt-0 space-y-4 sm:space-y-6 ${
                    isDateWiseFlowExpanded
                      ? "overflow-y-auto h-[500px] sm:h-[600px]"
                      : ""
                  }`}
                >
                  {(dateRangeReport?.dailyReports || []
                  ).map((dailyReportItem: any, idx: number) => {
                    // For daily reports, use the current dailyReport
                    const reportToUse =
                      dailyReportItem;
                    const dailyReports = dateRangeReport?.dailyReports || [];

                    const prevDayClosing =
                      idx > 0 ? dailyReports[idx - 1]?.closingBalance : null;
                    const prevDayCash = prevDayClosing?.cash || 0;
                    const prevDayBank =
                      prevDayClosing?.banks?.reduce(
                        (sum: number, bank: any) =>
                          sum + Number(bank.balance || 0),
                        0
                      ) || 0;

                    return (
                      <div
                        key={reportToUse.date || idx}
                        className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4"
                      >
                        <div className="mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-gray-200 dark:border-gray-700">
                          <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">
                            <span className="hidden sm:inline">
                              {new Date(reportToUse.date).toLocaleDateString(
                                "en-US",
                                {
                                  weekday: "long",
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                }
                              )}
                            </span>
                            <span className="sm:hidden">
                              {new Date(reportToUse.date).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                }
                              )}
                            </span>
                          </h3>
                          {idx > 0 && (
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                              <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2">
                                <span className="text-gray-600 dark:text-gray-400">
                                  Previous Day Cash:{" "}
                                </span>
                                <span className="font-semibold text-blue-600 price-responsive">
                                  {formatCompleteAmount(prevDayCash)}
                                </span>
                              </div>
                              {prevDayBank > 0 && (
                                <div className="bg-green-50 dark:bg-green-900/20 rounded p-2">
                                  <span className="text-gray-600 dark:text-gray-400">
                                    Previous Day Bank:{" "}
                                  </span>
                                  <span className="font-semibold text-green-600 price-responsive">
                                    {formatCompleteAmount(prevDayBank)}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="table-container">
                          <table className="responsive-table text-xs sm:text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="p-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[150px]">
                                  Description
                                </th>
                                <th className="p-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[100px]">
                                  Cash (Rs.)
                                </th>
                                <th className="p-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[100px]">
                                  Bank (Rs.)
                                </th>
                                <th className="p-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[100px]">
                                  Total (Rs.)
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-b border-gray-100 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/10">
                                <td className="p-2 font-semibold text-gray-800 dark:text-white text-xs sm:text-sm">
                                  {idx === 0 ? "Opening Balance" : "Brought Forward"}
                                </td>
                                <td className="p-2 text-right font-semibold text-blue-600 dark:text-blue-400 price-responsive whitespace-nowrap">
                                  {formatCompleteAmount(
                                    idx === 0
                                      ? reportToUse.openingBalance?.cash || 0
                                      : prevDayCash
                                  )}
                                </td>
                                <td className="p-2 text-right font-semibold text-blue-600 dark:text-blue-400 price-responsive whitespace-nowrap">
                                  {formatCompleteAmount(
                                    idx === 0
                                      ? (reportToUse.openingBalance?.banks?.reduce(
                                          (sum: number, bank: any) =>
                                            sum + Number(bank.balance || 0),
                                          0
                                        ) || 0)
                                      : prevDayBank
                                  )}
                                </td>
                                <td className="p-2 text-right font-semibold text-blue-600 dark:text-blue-400 price-responsive whitespace-nowrap">
                                  {formatCompleteAmount(
                                    idx === 0
                                      ? reportToUse.openingBalance?.total || 0
                                      : (prevDayCash + prevDayBank)
                                  )}
                                </td>
                              </tr>
                              {/* Opening Balance Additions - Always show to display daily additions breakdown */}
                              <tr className="border-b border-gray-100 dark:border-gray-700 bg-purple-50 dark:bg-purple-900/10">
                                <td className="p-2 font-semibold text-gray-800 dark:text-white text-xs sm:text-sm">
                                  Opening Balance Additions
                                  {reportToUse.openingBalanceAdditions &&
                                    reportToUse.openingBalanceAdditions.length >
                                      0 && (
                                      <span className="ml-2 text-xs font-normal text-gray-500">
                                        ({reportToUse.openingBalanceAdditions.length}{" "}
                                        {reportToUse.openingBalanceAdditions.length === 1
                                          ? "addition"
                                          : "additions"})
                                      </span>
                                    )}
                                </td>
                                <td className="p-2 text-right font-semibold text-purple-600 dark:text-purple-400 price-responsive whitespace-nowrap">
                                  {formatCompleteAmount(
                                    (reportToUse.openingBalanceAdditions || [])
                                      .filter(
                                        (add: any) =>
                                          (add.paymentType || "").toLowerCase() === "cash" ||
                                          !add.paymentType ||
                                          (add.paymentType || "").toLowerCase() !== "bank_transfer"
                                      )
                                      .reduce(
                                        (sum: number, add: any) =>
                                          sum +
                                          (add.type === "expense"
                                            ? -Number(add.amount || 0)
                                            : Number(add.amount || 0)),
                                        0
                                      )
                                  )}
                                </td>
                                <td className="p-2 text-right font-semibold text-purple-600 dark:text-purple-400 price-responsive whitespace-nowrap">
                                  {formatCompleteAmount(
                                    (reportToUse.openingBalanceAdditions || [])
                                      .filter(
                                        (add: any) =>
                                          (add.paymentType || "").toLowerCase() === "bank_transfer" ||
                                          (add.paymentType || "").includes("bank")
                                      )
                                      .reduce(
                                        (sum: number, add: any) =>
                                          sum +
                                          (add.type === "expense"
                                            ? -Number(add.amount || 0)
                                            : Number(add.amount || 0)),
                                        0
                                      )
                                  )}
                                </td>
                                <td className="p-2 text-right font-semibold text-purple-600 dark:text-purple-400 price-responsive whitespace-nowrap">
                                  {formatCompleteAmount(
                                    (reportToUse.openingBalanceAdditions || []).reduce(
                                      (sum: number, add: any) =>
                                        sum +
                                        (add.type === "expense"
                                          ? -Number(add.amount || 0)
                                          : Number(add.amount || 0)),
                                      0
                                    )
                                  )}
                                </td>
                              </tr>
                              <tr className="border-b border-gray-100 dark:border-gray-700 bg-green-50 dark:bg-green-900/10">
                                <td className="p-2 font-semibold text-gray-800 dark:text-white text-xs sm:text-sm">
                                  Sales
                                </td>
                                <td className="p-2 text-right font-semibold text-green-600 dark:text-green-400 price-responsive whitespace-nowrap">
                                  {formatCompleteAmount(reportToUse.sales?.cash || 0)}
                                </td>
                                <td className="p-2 text-right font-semibold text-green-600 dark:text-green-400 price-responsive whitespace-nowrap">
                                  {formatCompleteAmount(
                                    reportToUse.sales?.bank_transfer || 0
                                  )}
                                </td>
                                <td className="p-2 text-right font-semibold text-green-600 dark:text-green-400 price-responsive whitespace-nowrap">
                                  {formatCompleteAmount(reportToUse.sales?.total || 0)}
                                </td>
                              </tr>
                              <tr className="border-b border-gray-100 dark:border-gray-700 bg-orange-50 dark:bg-orange-900/10">
                                <td className="p-2 font-semibold text-gray-800 dark:text-white text-xs sm:text-sm">
                                  Purchases
                                </td>
                                <td className="p-2 text-right font-semibold text-orange-600 dark:text-orange-400 price-responsive whitespace-nowrap">
                                  -
                                  {formatCompleteAmount(
                                    reportToUse.purchases?.cash || 0
                                  )}
                                </td>
                                <td className="p-2 text-right font-semibold text-orange-600 dark:text-orange-400 price-responsive whitespace-nowrap">
                                  -
                                  {formatCompleteAmount(
                                    reportToUse.purchases?.bank_transfer || 0
                                  )}
                                </td>
                                <td className="p-2 text-right font-semibold text-orange-600 dark:text-orange-400 price-responsive whitespace-nowrap">
                                  -
                                  {formatCompleteAmount(
                                    reportToUse.purchases?.total || 0
                                  )}
                                </td>
                              </tr>
                              <tr className="border-b border-gray-100 dark:border-gray-700 bg-red-50 dark:bg-red-900/10">
                                <td className="p-2 font-semibold text-gray-800 dark:text-white text-xs sm:text-sm">
                                  Expenses
                                </td>
                                <td className="p-2 text-right font-semibold text-red-600 dark:text-red-400 price-responsive whitespace-nowrap">
                                  -
                                  {formatCompleteAmount(reportToUse.expenses?.cash || 0)}
                                </td>
                                <td className="p-2 text-right font-semibold text-red-600 dark:text-red-400 price-responsive whitespace-nowrap">
                                  -
                                  {formatCompleteAmount(
                                    reportToUse.expenses?.bank_transfer || 0
                                  )}
                                </td>
                                <td className="p-2 text-right font-semibold text-red-600 dark:text-red-400 price-responsive whitespace-nowrap">
                                  -
                                  {formatCompleteAmount(
                                    reportToUse.expenses?.total || 0
                                  )}
                                </td>
                              </tr>
                              <tr className="bg-gray-50 dark:bg-gray-900/20">
                                <td className="p-2 font-bold text-gray-800 dark:text-white text-xs sm:text-sm">
                                  Closing Balance
                                </td>
                                <td className="p-2 text-right font-bold text-green-600 dark:text-green-400 price-responsive whitespace-nowrap">
                                  {formatCompleteAmount(
                                    reportToUse.closingBalance?.cash || 0
                                  )}
                                </td>
                                <td className="p-2 text-right font-bold text-green-600 dark:text-green-400 price-responsive whitespace-nowrap">
                                  {formatCompleteAmount(
                                    reportToUse.closingBalance?.banks?.reduce(
                                      (sum: number, bank: any) =>
                                        sum + Number(bank.balance || 0),
                                      0
                                    ) ||
                                      reportToUse.closingBalance?.cards?.reduce(
                                        (sum: number, card: any) =>
                                          sum + (card.balance || 0),
                                        0
                                      ) ||
                                      0
                                  )}
                                </td>
                                <td className="p-2 text-right font-bold text-green-600 dark:text-green-400 price-responsive whitespace-nowrap">
                                  {formatCompleteAmount(
                                    reportToUse.closingBalance?.total || 0
                                  )}
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

        {/* Opening Balance Additions Report Table */}
        {openingBalanceAdditions && openingBalanceAdditions.length > 0 && (
          <div className="mb-6 p-3 sm:p-4 md:p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <h2 className="mb-4 text-lg sm:text-xl font-semibold text-gray-800 dark:text-white">
              Opening Balance Additions Report
            </h2>
            <div className="table-container">
              <table className="responsive-table">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="p-2 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[120px]">
                      Date & Time
                    </th>
                    <th className="p-2 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[100px]">
                      Payment Type
                    </th>
                    <th className="p-2 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[150px]">
                      Bank Account
                    </th>
                    <th className="p-2 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[200px]">
                      Description
                    </th>
                    <th className="p-2 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[100px]">
                      Added By
                    </th>
                    <th className="p-2 text-right text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[100px]">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {openingBalanceAdditions.map((add: any, index: number) => {
                    if (!add || !add.id) return null;

                    const addDate = add.time || add.date || add.createdAt;
                    return (
                      <tr
                        key={add.id || index}
                        className="border-b border-gray-100 dark:border-gray-700"
                      >
                        <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {formatBackendDate(addDate || add.time || add.date)}
                        </td>
                        <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap capitalize">
                          {add.paymentType === "bank_transfer" 
                            ? "Bank Transfer" 
                            : add.paymentType || "Cash"}
                        </td>
                        <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {add.bankAccount?.bankName || 
                           (add.bankAccountId ? "Bank Account" : "N/A")}
                          {add.bankAccount?.accountNumber && (
                            <div className="text-xs text-gray-500">
                              {add.bankAccount.accountNumber}
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-gray-700 dark:text-gray-300 max-w-[200px]">
                          <div className="line-clamp-2 truncate">
                            {add.description || "Opening Balance Addition"}
                          </div>
                        </td>
                        <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {add.userName || "N/A"}
                        </td>
                        <td className="p-2 text-right font-semibold text-purple-600 dark:text-purple-400 whitespace-nowrap price-responsive">
                          {formatCompleteAmount(Number(add.amount || 0))}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Summary Row with Cash and Bank Breakdown */}
                  <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900">
                    <td
                      colSpan={5}
                      className="p-2 font-bold text-gray-800 dark:text-white"
                    >
                      Total Opening Balance Additions
                    </td>
                    <td className="p-2 text-right font-bold text-purple-600 dark:text-purple-400">
                      {formatCompleteAmount(totalAdditionalBalance)}
                    </td>
                  </tr>
                  {/* Breakdown Row */}
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-purple-50 dark:bg-purple-900/20">
                    <td colSpan={5} className="p-2 pl-4 text-sm text-gray-700 dark:text-gray-300">
                      Breakdown:
                    </td>
                    <td className="p-2 text-right text-sm">
                      <div className="space-y-1">
                        <div className="text-blue-600 dark:text-blue-400">
                          Cash: {formatCompleteAmount(
                            openingBalanceAdditions
                              .filter((add: any) => 
                                (add.paymentType || "").toLowerCase() === "cash" || 
                                !add.paymentType ||
                                (add.paymentType || "").toLowerCase() !== "bank_transfer"
                              )
                              .reduce((sum: number, add: any) => sum + Number(add.amount || 0), 0)
                          )}
                        </div>
                        <div className="text-green-600 dark:text-green-400">
                          Bank: {formatCompleteAmount(
                            openingBalanceAdditions
                              .filter((add: any) => 
                                (add.paymentType || "").toLowerCase() === "bank_transfer" ||
                                (add.paymentType || "").includes("bank")
                              )
                              .reduce((sum: number, add: any) => sum + Number(add.amount || 0), 0)
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Purchases Report Table - Full Width */}
        {filteredPurchases.length > 0 ? (
          <div className="mb-6 p-3 sm:p-4 md:p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <h2 className="mb-4 text-lg sm:text-xl font-semibold text-gray-800 dark:text-white">
              Purchases Report
            </h2>
            <div className="table-container">
              <table className="responsive-table">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="p-2 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[120px]">
                      Date
                    </th>
                    <th className="p-2 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[150px]">
                      Supplier
                    </th>
                    <th className="p-2 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[200px]">
                      Items
                    </th>
                    <th className="p-2 text-right text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[100px]">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Deduplicate purchases by id + paymentIndex to prevent duplicates
                    const seenPurchaseKeys = new Set<string>();
                    return (filteredPurchases || []).filter((purchaseRow: any) => {
                      if (!purchaseRow || !purchaseRow.id) return false;
                      const paymentIndex = purchaseRow.paymentIndex !== undefined ? purchaseRow.paymentIndex : 0;
                      const key = `${purchaseRow.id}-${paymentIndex}`;
                      if (seenPurchaseKeys.has(key)) {
                        return false; // Skip duplicate
                      }
                      seenPurchaseKeys.add(key);
                      return true;
                    }).map((purchaseRow: any, index: number) => {
                      // Backend sends payment rows with paymentAmount and paymentDate
                      // If it's already a payment row (has paymentAmount), use it directly
                      // Otherwise, treat as legacy purchase format
                      const isPaymentRow =
                        purchaseRow.paymentAmount !== undefined;
                      const paymentDate = isPaymentRow
                        ? purchaseRow.paymentDate
                          ? new Date(purchaseRow.paymentDate)
                          : purchaseRow.date
                          ? new Date(purchaseRow.date)
                          : new Date()
                        : purchaseRow.date
                        ? new Date(purchaseRow.date)
                        : purchaseRow.createdAt
                        ? new Date(purchaseRow.createdAt)
                        : new Date();

                      const displayAmount = isPaymentRow
                        ? purchaseRow.paymentAmount
                        : purchaseRow.total || 0;

                      const paymentType = isPaymentRow
                        ? purchaseRow.paymentType
                        : "cash";

                      const paymentIndex = isPaymentRow
                        ? purchaseRow.paymentIndex
                        : 0;
                      const hasMultiplePayments =
                        isPaymentRow && paymentIndex > 0;

                      const items = (purchaseRow.items || []) as Array<{
                        productName: string;
                        quantity: number;
                      }>;

                      return (
                        <tr
                          key={
                            isPaymentRow
                              ? `${purchaseRow.id}-payment-${paymentIndex}-${index}`
                              : `${purchaseRow.id}-${index}`
                          }
                          className="border-b border-gray-100 dark:border-gray-700"
                        >
                          <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {formatBackendDate(
                              isPaymentRow
                                ? purchaseRow.paymentDate || purchaseRow.date
                                : purchaseRow.date || purchaseRow.createdAt
                            )}
                            {hasMultiplePayments && (
                              <span className="text-xs text-gray-500 ml-1">
                                (Payment {paymentIndex + 1})
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-gray-700 dark:text-gray-300">
                            {purchaseRow.supplierName || "N/A"}
                          </td>
                          <td className="p-2 text-gray-700 dark:text-gray-300 max-w-[200px]">
                            <div className="line-clamp-2 truncate">
                              {items.length > 0
                                ? items
                                    .map(
                                      (item) =>
                                        `${item.productName} (${item.quantity})`
                                    )
                                    .join(", ")
                                : "N/A"}
                            </div>
                          </td>
                          <td className="p-2 text-right font-semibold text-gray-800 dark:text-white whitespace-nowrap">
                            <div className="price-responsive">
                              {formatCompleteAmount(Number(displayAmount || 0))}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {paymentType.toUpperCase()}
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                  <tr className="border-t-2 border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900">
                    <td
                      colSpan={3}
                      className="p-2 font-bold text-gray-800 dark:text-white"
                    >
                      Total Purchases
                    </td>
                    <td className="p-2 text-right font-bold text-orange-600 dark:text-orange-400">
                      {formatCompleteAmount(totalPurchases)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="mb-6 p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
              Purchases Report
            </h2>
            <div className="text-center py-8 text-gray-500">
              No purchases found for the selected date range
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
          {/* Sales Report Table - Left Side */}
          <div className="p-3 sm:p-4 md:p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <h2 className="mb-4 text-lg sm:text-xl font-semibold text-gray-800 dark:text-white">
              Sales Report
            </h2>
            <div className="table-container">
              <table className="responsive-table">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="p-2 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[100px]">
                      Bill #
                    </th>
                    <th className="p-2 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[120px]">
                      Date
                    </th>
                    <th className="p-2 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[150px]">
                      Customer
                    </th>
                    <th className="p-2 text-right text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[100px]">
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
                      {/* Payment Rows - Backend now sends payment rows, each payment is a separate row */}
                      {(() => {
                        // Deduplicate sales by id + paymentIndex to prevent duplicates
                        const seenSaleKeys = new Set<string>();
                        return (filteredSales || []).filter((paymentRow: any) => {
                          if (!paymentRow || !paymentRow.id) return false;
                          const paymentIndex = paymentRow.paymentIndex !== undefined ? paymentRow.paymentIndex : 0;
                          const key = `${paymentRow.id}-${paymentIndex}`;
                          if (seenSaleKeys.has(key)) {
                            return false; // Skip duplicate
                          }
                          seenSaleKeys.add(key);
                          return true;
                        }).map(
                          (paymentRow: any, index: number) => {

                          // Backend sends payment rows with paymentAmount and paymentDate
                          // If it's already a payment row (has paymentAmount), use it directly
                          // Otherwise, treat as legacy sale format
                          const isPaymentRow =
                            paymentRow.paymentAmount !== undefined;
                          const paymentDate = isPaymentRow
                            ? paymentRow.paymentDate
                              ? new Date(paymentRow.paymentDate)
                              : paymentRow.date
                              ? new Date(paymentRow.date)
                              : new Date()
                            : paymentRow.date
                            ? new Date(paymentRow.date)
                            : paymentRow.createdAt
                            ? new Date(paymentRow.createdAt)
                            : new Date();

                          const displayAmount = isPaymentRow
                            ? paymentRow.paymentAmount
                            : paymentRow.total || 0;

                          const paymentType = isPaymentRow
                            ? paymentRow.paymentType
                            : paymentRow.paymentType || "cash";

                          const paymentIndex = isPaymentRow
                            ? paymentRow.paymentIndex
                            : 0;
                          const hasMultiplePayments =
                            isPaymentRow && paymentIndex > 0;

                          return (
                            <tr
                              key={
                                isPaymentRow
                                  ? `${paymentRow.id}-payment-${paymentIndex}-${index}`
                                  : `${paymentRow.id}-${index}`
                              }
                              className="border-b border-gray-100 dark:border-gray-700"
                            >
                              <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                {paymentRow.billNumber || ""}
                                {hasMultiplePayments && (
                                  <span className="text-xs text-gray-500 ml-1">
                                    (Payment {paymentIndex + 1})
                                  </span>
                                )}
                              </td>
                              <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                {formatBackendDate(
                                  isPaymentRow
                                    ? paymentRow.paymentDate || paymentRow.date
                                    : paymentRow.date || paymentRow.createdAt
                                )}
                              </td>
                              <td className="p-2 text-gray-700 dark:text-gray-300 max-w-[150px]">
                                <div className="line-clamp-3 truncate">
                                  {paymentRow.customerName || "Walk-in"}
                                </div>
                              </td>
                              <td className="p-2 text-right font-semibold text-gray-800 dark:text-white whitespace-nowrap">
                                <div>
                                  {formatCompleteAmount(Number(displayAmount || 0))}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">
                                  {paymentType.toUpperCase()}
                                </div>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Expenses Report Table - Right Side */}
          <div className="p-3 sm:p-4 md:p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <h2 className="mb-4 text-lg sm:text-xl font-semibold text-gray-800 dark:text-white">
              Expenses Report
            </h2>
            <div className="table-container">
              <table className="responsive-table">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="p-2 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[100px]">
                      Date
                    </th>
                    <th className="p-2 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[100px]">
                      Category
                    </th>
                    <th className="p-2 text-left text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[200px]">
                      Description
                    </th>
                    <th className="p-2 text-right text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[100px]">
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
                    (filteredExpenses || [])
                      .map((expense) => {
                        if (!expense || !expense.id) return null;
                        return (
                          <tr
                            key={expense.id}
                            className="border-b border-gray-100 dark:border-gray-700"
                          >
                            <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {formatBackendDate(expense.date)}
                            </td>
                            <td className="p-2 text-gray-700 dark:text-gray-300 capitalize whitespace-nowrap">
                              {expense.category || ""}
                            </td>
                            <td className="p-2 text-gray-700 dark:text-gray-300 max-w-[200px]">
                              <div className="line-clamp-3 truncate">
                                {expense.description || ""}
                              </div>
                            </td>
                            <td className="p-2 text-right font-semibold text-gray-800 dark:text-white whitespace-nowrap price-responsive">
                              {formatCompleteAmount(Number(expense.amount || 0))}
                            </td>
                          </tr>
                        );
                      })
                      .filter(Boolean)
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
}