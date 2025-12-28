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
import { formatPrice, formatPriceWithCurrency } from "../../utils/priceHelpers";

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

  // Get opening balance additions from daily or date range report
  const openingBalanceAdditions = (reportType === "daily" && dailyReport?.openingBalanceAdditions) 
    ? dailyReport.openingBalanceAdditions 
    : (dateRangeReport?.openingBalanceAdditions || []);
  
  // Calculate total additional balance (opening balance additions)
  const totalAdditionalBalance = openingBalanceAdditions.reduce((sum: number, add: any) => sum + Number(add.amount || 0), 0);

  if (isUsingBackendData && reportType === "daily" && dailyReport) {
    filteredSales = dailyReport.sales?.items || [];
    filteredExpenses = dailyReport.expenses?.items || [];
    filteredPurchases = dailyReport.purchases?.items || [];
    totalSales = dailyReport.sales?.total || 0;
    totalExpenses = dailyReport.expenses?.total || 0;
    totalPurchases = dailyReport.purchases?.total || 0;
    openingBalance = dailyReport.openingBalance?.total || 0;
    openingCash = dailyReport.openingBalance?.cash || 0;
    // Backend now returns banks properly with bankName and accountNumber
    const openingBanks = (dailyReport.openingBalance as any)?.banks || [];
    openingBankTotal = openingBanks.reduce((sum: number, bank: any) => sum + Number(bank.balance || 0), 0);
    // Map opening banks with details for display
    openingBankBalances = openingBanks.map((bank: any) => ({
      bankAccountId: bank.bankAccountId,
      bankName: bank.bankName || "Unknown",
      accountNumber: bank.accountNumber || "",
      balance: Number(bank.balance || 0),
    }));
    
    closingBalance = dailyReport.closingBalance?.total || 0;
    closingCash = dailyReport.closingBalance?.cash || 0;
    const closingBanks = (dailyReport.closingBalance as any)?.banks || [];
    closingBankTotal = closingBanks.reduce((sum: number, bank: any) => sum + Number(bank.balance || 0), 0);
    
    profit = totalSales - totalExpenses - totalPurchases;
  } else if (isUsingBackendData && dateRangeReport) {
    // Aggregate data from all dailyReports
    const allSales: any[] = [];
    const allPurchases: any[] = [];
    const allExpenses: any[] = [];
    
    if (dateRangeReport.dailyReports && dateRangeReport.dailyReports.length > 0) {
      dateRangeReport.dailyReports.forEach((dailyReport: any) => {
        if (dailyReport.sales?.items) {
          allSales.push(...dailyReport.sales.items);
        }
        if (dailyReport.purchases?.items) {
          allPurchases.push(...dailyReport.purchases.items);
        }
        if (dailyReport.expenses?.items) {
          allExpenses.push(...dailyReport.expenses.items);
        }
      });
    }
    
    filteredSales = allSales;
    filteredExpenses = allExpenses;
    filteredPurchases = allPurchases;
    
    // Calculate totals from aggregated data (use dailyReports totals which are more accurate)
    // First try to sum from dailyReports, then fallback to summary or calculate from items
    const calculatedSalesTotal = dateRangeReport.dailyReports?.reduce((sum: number, dr: any) => sum + (dr.sales?.total || 0), 0) || 0;
    const calculatedPurchasesTotal = dateRangeReport.dailyReports?.reduce((sum: number, dr: any) => sum + (dr.purchases?.total || 0), 0) || 0;
    const calculatedExpensesTotal = dateRangeReport.dailyReports?.reduce((sum: number, dr: any) => sum + (dr.expenses?.total || 0), 0) || 0;
    
    totalSales = calculatedSalesTotal || dateRangeReport.summary?.sales?.total || allSales.reduce((sum: number, sale: any) => sum + Number(sale.paymentAmount || sale.total || 0), 0);
    totalExpenses = calculatedExpensesTotal || dateRangeReport.summary?.expenses?.total || allExpenses.reduce((sum: number, expense: any) => sum + Number(expense.amount || 0), 0);
    totalPurchases = calculatedPurchasesTotal || dateRangeReport.summary?.purchases?.total || allPurchases.reduce((sum: number, purchase: any) => sum + Number(purchase.paymentAmount || purchase.total || 0), 0);
    
    // For opening balance, use first daily report's opening balance
    const firstDailyReport = dateRangeReport.dailyReports?.[0];
    openingBalance = firstDailyReport?.openingBalance?.total || dateRangeReport.summary?.openingBalance?.total || 0;
    openingCash = firstDailyReport?.openingBalance?.cash || dateRangeReport.summary?.openingBalance?.cash || 0;
    // For date range report, get banks from summary openingBalance.banks
    const summaryOpeningBanks = (dateRangeReport.summary?.openingBalance as any)?.banks || [];
    if (summaryOpeningBanks.length > 0) {
      openingBankTotal = summaryOpeningBanks.reduce((sum: number, bank: any) => sum + Number(bank.balance || 0), 0);
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
        openingBankTotal = openingBanks.reduce((sum: number, bank: any) => sum + Number(bank.balance || 0), 0);
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
    const lastDailyReport = dateRangeReport.dailyReports && dateRangeReport.dailyReports.length > 0 
      ? dateRangeReport.dailyReports[dateRangeReport.dailyReports.length - 1]
      : null;
    
    closingBalance = lastDailyReport?.closingBalance?.total || dateRangeReport.summary?.closingBalance?.total || 0;
    closingCash = lastDailyReport?.closingBalance?.cash || dateRangeReport.summary?.closingBalance?.cash || 0;
    
    // For date range report, get closing bank balance from last daily report or summary
    if (lastDailyReport?.closingBalance?.banks && lastDailyReport.closingBalance.banks.length > 0) {
      const closingBanks = lastDailyReport.closingBalance.banks || [];
      closingBankTotal = closingBanks.reduce((sum: number, bank: any) => sum + Number(bank.balance || 0), 0);
    } else {
      const summaryClosingBanks = (dateRangeReport.summary?.closingBalance as any)?.banks || [];
      if (summaryClosingBanks.length > 0) {
        closingBankTotal = summaryClosingBanks.reduce((sum: number, bank: any) => sum + Number(bank.balance || 0), 0);
      } else {
        // Fallback to cards if banks not available (legacy)
        closingBankTotal = dateRangeReport.summary?.closingBalance?.cards || 0;
      }
    }
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

    // Fetch all balance transactions for the date range to get before/after balances
    let allBalanceTransactions: any[] = [];
    try {
      const transactionsResponse = await api.getTransactions({
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      // Ensure it's an array
      allBalanceTransactions = Array.isArray(transactionsResponse) ? transactionsResponse : (transactionsResponse?.data || []);
      // Sort by creation time
      if (Array.isArray(allBalanceTransactions)) {
        allBalanceTransactions.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
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
        if (tx && typeof tx === 'object') {
          const key = `${tx.source || ''}_${tx.sourceId || ''}_${tx.paymentType || 'cash'}`;
          if (!balanceTxMap.has(key)) {
            balanceTxMap.set(key, []);
          }
          balanceTxMap.get(key)!.push(tx);
        }
      });
    }

    // Build comprehensive chronological report for print
    const reportsToProcess = reportType === "daily" && dailyReport 
      ? [dailyReport] 
      : (dateRangeReport?.dailyReports || []);
    
    let printContent = '';
    
    reportsToProcess.forEach((report: any, reportIdx: number) => {
      const reportDate = report.date || (reportType === "daily" ? dateRange.start : '');
      
      // Calculate opening bank total once per report
      const openingBankTotal = report.openingBalance?.banks?.reduce((sum: number, bank: any) => sum + Number(bank.balance || 0), 0) || 0;
      
      printContent += `<h2>Date: ${new Date(reportDate).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}</h2>`;
      
      // Opening Balance - Simple header before transaction table
      printContent += `<div style="margin-bottom: 15px;">
        <p style="font-size: 12px; color: #6b7280; margin: 5px 0;"><strong>Opening Balance:</strong> Cash: Rs. ${(report.openingBalance?.cash || 0).toFixed(2)}, Bank: Rs. ${openingBankTotal.toFixed(2)}, Total: Rs. ${(report.openingBalance?.total || 0).toFixed(2)}</p>
      </div>`;
      
      // Build chronological transaction table
      const allTransactions: any[] = [];
      
      // Add opening balance additions
      if (report.openingBalanceAdditions && report.openingBalanceAdditions.length > 0) {
        report.openingBalanceAdditions.forEach((add: any) => {
        const addDateTime = add.time ? new Date(add.time) : (add.date ? new Date(add.date) : new Date(reportDate));
        allTransactions.push({
          type: 'Additional Balance',
          datetime: addDateTime,
          date: add.date || add.time || reportDate,
          time: add.time || new Date(add.date || reportDate).toTimeString(),
          paymentType: add.paymentType,
          amount: Number(add.amount || 0),
          beforeBalance: add.beforeBalance,
          afterBalance: add.afterBalance,
          description: add.description || 'Opening Balance Addition',
          bankName: add.bankAccount?.bankName || '',
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
              const key = `purchase_payment_${purchase.id}_${p.type || 'cash'}`;
              let balanceTxs = balanceTxMap.get(key) || [];
              if (balanceTxs.length === 0) {
                const key2 = `purchase_${purchase.id}_${p.type || 'cash'}`;
                balanceTxs = balanceTxMap.get(key2) || [];
              }
              const balanceTx = balanceTxs.length > idx ? balanceTxs[idx] : (balanceTxs.length > 0 ? balanceTxs[0] : null);
              
              allTransactions.push({
                type: 'Purchase',
                datetime: paymentDateTime,
                date: paymentDate,
                time: paymentDateTime.toLocaleTimeString(),
                paymentType: p.type || 'cash',
                amount: Number(p.amount || 0),
                beforeBalance: balanceTx?.beforeBalance !== null && balanceTx?.beforeBalance !== undefined ? Number(balanceTx.beforeBalance) : null,
                afterBalance: balanceTx?.afterBalance !== null && balanceTx?.afterBalance !== undefined ? Number(balanceTx.afterBalance) : null,
                description: `Purchase - ${purchase.supplierName || 'N/A'}`,
                bankName: p.bankAccountId ? 'Bank Transfer' : '',
              });
            });
          } else {
            const purchaseDate = purchase.date || purchase.createdAt;
            const purchaseDateTime = new Date(purchaseDate);
            const key = `purchase_${purchase.id}_${purchase.paymentType || 'cash'}`;
            const balanceTxs = balanceTxMap.get(key) || [];
            const balanceTx = balanceTxs.length > 0 ? balanceTxs[0] : null;
            
            allTransactions.push({
              type: 'Purchase',
              datetime: purchaseDateTime,
              date: purchaseDate,
              time: purchaseDateTime.toLocaleTimeString(),
              paymentType: purchase.paymentType || 'cash',
              amount: Number(purchase.total || 0),
              beforeBalance: balanceTx?.beforeBalance !== null && balanceTx?.beforeBalance !== undefined ? Number(balanceTx.beforeBalance) : null,
              afterBalance: balanceTx?.afterBalance !== null && balanceTx?.afterBalance !== undefined ? Number(balanceTx.afterBalance) : null,
              description: `Purchase - ${purchase.supplierName || 'N/A'}`,
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
              const key = `sale_payment_${sale.id}_${p.type || 'cash'}`;
              let balanceTxs = balanceTxMap.get(key) || [];
              if (balanceTxs.length === 0) {
                const key2 = `sale_${sale.id}_${p.type || 'cash'}`;
                balanceTxs = balanceTxMap.get(key2) || [];
              }
              const balanceTx = balanceTxs.length > idx ? balanceTxs[idx] : (balanceTxs.length > 0 ? balanceTxs[0] : null);
              
              allTransactions.push({
                type: 'Sale',
                datetime: paymentDateTime,
                date: paymentDate,
                time: paymentDateTime.toLocaleTimeString(),
                paymentType: p.type || 'cash',
                amount: Number(p.amount || 0),
                beforeBalance: balanceTx?.beforeBalance !== null && balanceTx?.beforeBalance !== undefined ? Number(balanceTx.beforeBalance) : null,
                afterBalance: balanceTx?.afterBalance !== null && balanceTx?.afterBalance !== undefined ? Number(balanceTx.afterBalance) : null,
                description: `Sale - Bill #${sale.billNumber || 'N/A'} - ${sale.customerName || 'Walk-in'}`,
                bankName: p.bankAccountId ? 'Bank Transfer' : '',
              });
            });
          } else {
            const saleDate = sale.date || sale.createdAt;
            const saleDateTime = new Date(saleDate);
            const key = `sale_${sale.id}_${sale.paymentType || 'cash'}`;
            const balanceTxs = balanceTxMap.get(key) || [];
            const balanceTx = balanceTxs.length > 0 ? balanceTxs[0] : null;
            
            allTransactions.push({
              type: 'Sale',
              datetime: saleDateTime,
              date: saleDate,
              time: saleDateTime.toLocaleTimeString(),
              paymentType: sale.paymentType || 'cash',
              amount: Number(sale.total || 0),
              beforeBalance: balanceTx?.beforeBalance !== null && balanceTx?.beforeBalance !== undefined ? Number(balanceTx.beforeBalance) : null,
              afterBalance: balanceTx?.afterBalance !== null && balanceTx?.afterBalance !== undefined ? Number(balanceTx.afterBalance) : null,
              description: `Sale - Bill #${sale.billNumber || 'N/A'} - ${sale.customerName || 'Walk-in'}`,
            });
          }
        });
      }
      
      // Add expenses with balance transaction data
      if (report.expenses?.items && report.expenses.items.length > 0) {
        report.expenses.items.forEach((expense: any) => {
          const expenseDate = expense.date || expense.createdAt;
          const expenseDateTime = new Date(expenseDate);
          const key = `expense_${expense.id}_${expense.paymentType || 'cash'}`;
          const balanceTxs = balanceTxMap.get(key) || [];
          const balanceTx = balanceTxs.length > 0 ? balanceTxs[0] : null;
          
          allTransactions.push({
            type: 'Expense',
            datetime: expenseDateTime,
            date: expenseDate,
            time: expenseDateTime.toLocaleTimeString(),
            paymentType: expense.paymentType || 'cash',
            amount: Number(expense.amount || 0),
            beforeBalance: balanceTx?.beforeBalance !== null && balanceTx?.beforeBalance !== undefined ? Number(balanceTx.beforeBalance) : null,
            afterBalance: balanceTx?.afterBalance !== null && balanceTx?.afterBalance !== undefined ? Number(balanceTx.afterBalance) : null,
            description: expense.description || expense.category || 'Expense',
            bankName: expense.bankAccountId ? 'Bank Transfer' : '',
          });
        });
      }
      
      // Sort all transactions by datetime
      allTransactions.sort((a, b) => {
        const dateTimeA = a.datetime ? a.datetime.getTime() : new Date(a.date).getTime();
        const dateTimeB = b.datetime ? b.datetime.getTime() : new Date(b.date).getTime();
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
            'Sale': 'Sale Payment',
            'Purchase': 'Purchase Payment',
            'Expense': 'Expense Payment',
            'Additional Balance': 'Add to Opening Balance',
          };
          return labels[type] || type;
        };
        
        // Helper function to format currency
        const formatCurrency = (amount: number) => {
          return `Rs. ${amount.toFixed(2)}`;
        };
        
        allTransactions.forEach((tran) => {
          const isIncome = tran.type === 'Sale' || tran.type === 'Additional Balance';
          const dateTime = tran.datetime || (tran.date ? new Date(tran.date) : new Date());
          
          // Determine row background color based on income/expense
          const rowBgColor = isIncome ? '#f0fdf4' : '#fef2f2'; // green-50 or red-50
          const typeBadgeColor = isIncome ? '#dcfce7' : '#fee2e2'; // green-200 or red-200
          const typeTextColor = isIncome ? '#166534' : '#991b1b'; // green-800 or red-800
          const amountColor = isIncome ? '#16a34a' : '#dc2626'; // green-600 or red-600
          
          printContent += `<tr style="background-color: ${rowBgColor}; border-bottom: 1px solid #e5e7eb;">
            <td style="border: 1px solid #e5e7eb; padding: 8px; white-space: nowrap;">${dateTime.toLocaleString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit'
            })}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px;">
              <span style="background-color: ${typeBadgeColor}; color: ${typeTextColor}; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;">
                ${isIncome ? 'Income' : 'Expense'}
              </span>
            </td>
            <td style="border: 1px solid #e5e7eb; padding: 8px;">${getSourceLabel(tran.type)}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${tran.description || '-'}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-transform: capitalize;">${tran.paymentType === 'cash' ? 'Cash' : 'Bank Transfer'}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; font-size: 10px;">${tran.bankName || '-'}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">${tran.beforeBalance !== null && tran.beforeBalance !== undefined ? formatCurrency(Number(tran.beforeBalance)) : '-'}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; color: ${amountColor}; font-weight: 600;">
              ${isIncome ? '+' : '-'}${formatCurrency(tran.amount)}
            </td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right;">${tran.afterBalance !== null && tran.afterBalance !== undefined ? formatCurrency(Number(tran.afterBalance)) : '-'}</td>
          </tr>`;
        });
        
        printContent += `</tbody></table>`;
      }
      
      // Summary - Simple table format matching date-wise financial flow design
      const additionalTotal = report.openingBalanceAdditions?.reduce((sum: number, add: any) => sum + Number(add.amount || 0), 0) || 0;
      const closingBankTotal = report.closingBalance?.banks?.reduce((sum: number, bank: any) => sum + Number(bank.balance || 0), 0) || 0;
      // Reuse openingBankTotal calculated at the start of the loop
      
      printContent += `<h3 style="margin-top: 20px; margin-bottom: 10px; font-size: 16px; font-weight: bold;">Summary</h3>`;
      printContent += `<table style="width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 11px;">
        <thead>
          <tr style="background-color: #f3f4f6; border-bottom: 2px solid #d1d5db;">
            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: left; font-weight: 600;">Description</th>
            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: 600;">Cash (Rs.)</th>
            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: 600;">Bank (Rs.)</th>
            <th style="border: 1px solid #d1d5db; padding: 8px; text-align: right; font-weight: 600;">Total (Rs.)</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background-color: #dbeafe; border-bottom: 1px solid #e5e7eb;">
            <td style="border: 1px solid #e5e7eb; padding: 8px; font-weight: 600;">Opening Balance</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #2563eb;">${(report.openingBalance?.cash || 0).toFixed(2)}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #2563eb;">${openingBankTotal.toFixed(2)}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #2563eb;">${(report.openingBalance?.total || 0).toFixed(2)}</td>
          </tr>`;
      
      if (additionalTotal > 0) {
        const additionalCash = report.openingBalanceAdditions?.filter((add: any) => add.paymentType === "cash").reduce((sum: number, add: any) => sum + Number(add.amount || 0), 0) || 0;
        const additionalBank = additionalTotal - additionalCash;
        printContent += `
          <tr style="background-color: #f3e8ff; border-bottom: 1px solid #e5e7eb;">
            <td style="border: 1px solid #e5e7eb; padding: 8px; font-weight: 600;">Opening Balance Additions</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #9333ea;">${additionalCash.toFixed(2)}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #9333ea;">${additionalBank.toFixed(2)}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #9333ea;">${additionalTotal.toFixed(2)}</td>
          </tr>`;
      }
      
      printContent += `
          <tr style="background-color: #d1fae5; border-bottom: 1px solid #e5e7eb;">
            <td style="border: 1px solid #e5e7eb; padding: 8px; font-weight: 600;">Sales</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #16a34a;">${(report.sales?.cash || 0).toFixed(2)}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #16a34a;">${(report.sales?.bank_transfer || 0).toFixed(2)}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #16a34a;">${(report.sales?.total || 0).toFixed(2)}</td>
          </tr>
          <tr style="background-color: #fed7aa; border-bottom: 1px solid #e5e7eb;">
            <td style="border: 1px solid #e5e7eb; padding: 8px; font-weight: 600;">Purchases</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #ea580c;">-${(report.purchases?.cash || 0).toFixed(2)}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #ea580c;">-${(report.purchases?.bank_transfer || 0).toFixed(2)}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #ea580c;">-${(report.purchases?.total || 0).toFixed(2)}</td>
          </tr>
          <tr style="background-color: #fee2e2; border-bottom: 1px solid #e5e7eb;">
            <td style="border: 1px solid #e5e7eb; padding: 8px; font-weight: 600;">Expenses</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #dc2626;">-${(report.expenses?.cash || 0).toFixed(2)}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #dc2626;">-${(report.expenses?.bank_transfer || 0).toFixed(2)}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: 600; color: #dc2626;">-${(report.expenses?.total || 0).toFixed(2)}</td>
          </tr>
          <tr style="background-color: #e0e7ff; border-top: 2px solid #6366f1; border-bottom: 2px solid #6366f1;">
            <td style="border: 1px solid #e5e7eb; padding: 8px; font-weight: bold; font-size: 12px;">Closing Balance</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: bold; font-size: 12px; color: #4f46e5;">${(report.closingBalance?.cash || 0).toFixed(2)}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: bold; font-size: 12px; color: #4f46e5;">${closingBankTotal.toFixed(2)}</td>
            <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: right; font-weight: bold; font-size: 12px; color: #4f46e5;">${(report.closingBalance?.total || 0).toFixed(2)}</td>
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
    <>
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

        <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-3 no-print">
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
                  <div className="mb-6 p-4 sm:p-6 bg-gray-50 dark:bg-gray-900/20 rounded-lg border-2 border-gray-200 dark:border-gray-800">
                    <h2 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white mb-3 sm:mb-4">
                      Previous Day Closing Balance (Opening Balance)
                    </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 sm:p-4 border border-blue-200 dark:border-blue-800">
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Cash Balance</p>
                        <p className="text-lg sm:text-xl lg:text-2xl font-bold text-blue-600 price-responsive">
                          {formatPriceWithCurrency(Number(previousDayBalance.cashBalance || 0))}
                        </p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 sm:p-4 border border-green-200 dark:border-green-800">
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-1">Total Bank Balance</p>
                        <p className="text-lg sm:text-xl lg:text-2xl font-bold text-green-600 price-responsive">
                          {formatPriceWithCurrency(Number(previousDayBalance.bankBalances?.reduce((sum, b) => sum + Number(b.balance || 0), 0) || 0))}
                        </p>
                      </div>
                    </div>
                    {openingBankBalances.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Bank-wise Balances:</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {openingBankBalances.map((bank) => (
                            <div key={bank.bankAccountId} className="bg-white dark:bg-gray-800 rounded p-2 border border-gray-200 dark:border-gray-700">
                              <p className="text-xs text-gray-500 dark:text-gray-400">{bank.bankName}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">{bank.accountNumber}</p>
                              <p className="text-xs sm:text-sm font-bold text-gray-800 dark:text-white price-responsive">{formatPriceWithCurrency(Number(bank.balance || 0))}</p>
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
                        {formatPriceWithCurrency(openingBalance)}
                      </p>
                      {(openingCash > 0 || openingBankTotal > 0) && (
                        <div className="mt-2 text-xs text-gray-500">
                          <div>Cash: Rs. {openingCash.toFixed(2)}</div>
                          {openingBankTotal > 0 && <div>Bank: Rs. {openingBankTotal.toFixed(2)}</div>}
                        </div>
                      )}
                      {openingBankBalances.length > 0 && (
                        <div className="mt-2 text-xs text-gray-500 space-y-1">
                          {openingBankBalances.map((bank) => (
                            <div key={bank.bankAccountId}>
                              {bank.bankName}: Rs. {bank.balance.toFixed(2)}
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
                      {formatPriceWithCurrency(totalSales)}
                    </p>
                  </div>
                  <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      Total Purchases
                    </p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold text-orange-600 dark:text-orange-400 price-responsive">
                      {formatPriceWithCurrency(totalPurchases)}
                    </p>
                  </div>
                  {isUsingBackendData && totalAdditionalBalance > 0 && (
                    <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                      <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                        Total Additional Balance
                      </p>
                      <p className="text-lg sm:text-xl lg:text-2xl font-bold text-purple-600 dark:text-purple-400 price-responsive">
                        {formatPriceWithCurrency(totalAdditionalBalance)}
                      </p>
                    </div>
                  )}
                  <div className="p-3 sm:p-4 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      Total Expenses
                    </p>
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold text-red-600 dark:text-red-400 price-responsive">
                      {formatPriceWithCurrency(totalExpenses)}
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
                      {formatPriceWithCurrency(isUsingBackendData ? closingBalance : profit)}
                    </p>
                    {isUsingBackendData && (closingCash > 0 || closingBankTotal > 0) ? (
                      <div className="mt-2 text-xs text-gray-500">
                        <div>Cash: Rs. {closingCash.toFixed(2)}</div>
                        {closingBankTotal > 0 && <div>Bank: Rs. {closingBankTotal.toFixed(2)}</div>}
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
              </>
            )}

            <div className="mb-6 flex gap-2 no-print flex-wrap">
              <Button onClick={exportToPDF} size="sm">
                <DownloadIcon className="w-4 h-4 mr-2" />
                Print / PDF
              </Button>
             
            </div>

            {/* Date-wise Financial Flow - For Daily, Custom Range, Weekly/Monthly */}
            {isUsingBackendData && ((reportType === "daily" && dailyReport) || (dateRangeReport && dateRangeReport.dailyReports && dateRangeReport.dailyReports.length > 0)) && (
              <div className="mb-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
                <button
                  onClick={() => setIsDateWiseFlowExpanded(!isDateWiseFlowExpanded)}
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
                  <div className={`p-3 sm:p-4 md:p-6 pt-0 space-y-4 sm:space-y-6 ${isDateWiseFlowExpanded ? "overflow-y-auto h-[500px] sm:h-[600px]" : ""}`}>
                  {(reportType === "daily" && dailyReport 
                    ? [dailyReport] 
                    : (dateRangeReport?.dailyReports || [])).map((dailyReportItem: any, idx: number) => {
                    // For daily reports, use the current dailyReport
                    const reportToUse = reportType === "daily" ? dailyReport : dailyReportItem;
                    const dailyReports = reportType === "daily" ? [dailyReport] : (dateRangeReport?.dailyReports || []);
                    
                    const prevDayClosing = idx > 0 
                      ? dailyReports[idx - 1]?.closingBalance
                      : null;
                    const prevDayCash = prevDayClosing?.cash || 0;
                    const prevDayBank = prevDayClosing?.banks?.reduce((sum: number, bank: any) => sum + Number(bank.balance || 0), 0) || 0;
                    
                    return (
                      <div key={reportToUse.date || idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 sm:p-4">
                        <div className="mb-3 sm:mb-4 pb-2 sm:pb-3 border-b border-gray-200 dark:border-gray-700">
                          <h3 className="text-base sm:text-lg font-bold text-gray-800 dark:text-white">
                            <span className="hidden sm:inline">
                              {new Date(reportToUse.date).toLocaleDateString('en-US', { 
                                weekday: 'long', 
                                year: 'numeric', 
                                month: 'long', 
                                day: 'numeric' 
                              })}
                            </span>
                            <span className="sm:hidden">
                              {new Date(reportToUse.date).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric',
                                year: 'numeric'
                              })}
                            </span>
                          </h3>
                          {idx > 0 && (
                            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm">
                              <div className="bg-blue-50 dark:bg-blue-900/20 rounded p-2">
                                <span className="text-gray-600 dark:text-gray-400">Previous Day Cash: </span>
                                <span className="font-semibold text-blue-600 price-responsive">{formatPriceWithCurrency(prevDayCash)}</span>
                              </div>
                              {prevDayBank > 0 && (
                                <div className="bg-green-50 dark:bg-green-900/20 rounded p-2">
                                  <span className="text-gray-600 dark:text-gray-400">Previous Day Bank: </span>
                                  <span className="font-semibold text-green-600 price-responsive">{formatPriceWithCurrency(prevDayBank)}</span>
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
                                  Opening Balance
                                </td>
                                <td className="p-2 text-right font-semibold text-blue-600 dark:text-blue-400 price-responsive whitespace-nowrap">
                                  {formatPrice(reportToUse.openingBalance?.cash || 0)}
                                </td>
                                <td className="p-2 text-right font-semibold text-blue-600 dark:text-blue-400 price-responsive whitespace-nowrap">
                                  {formatPrice(reportToUse.openingBalance?.banks?.reduce((sum: number, bank: any) => sum + Number(bank.balance || 0), 0) || 0)}
                                </td>
                                <td className="p-2 text-right font-semibold text-blue-600 dark:text-blue-400 price-responsive whitespace-nowrap">
                                  {formatPrice(reportToUse.openingBalance?.total || 0)}
                                </td>
                              </tr>
                              {/* Opening Balance Additions */}
                              {reportToUse.openingBalanceAdditions && reportToUse.openingBalanceAdditions.length > 0 && (
                                <tr className="border-b border-gray-100 dark:border-gray-700 bg-purple-50 dark:bg-purple-900/10">
                                  <td className="p-2 font-semibold text-gray-800 dark:text-white text-xs sm:text-sm">
                                    Opening Balance Additions
                                  </td>
                                  <td className="p-2 text-right font-semibold text-purple-600 dark:text-purple-400 price-responsive whitespace-nowrap">
                                    {formatPrice(reportToUse.openingBalanceAdditions
                                      .filter((add: any) => add.paymentType === "cash")
                                      .reduce((sum: number, add: any) => sum + Number(add.amount || 0), 0))}
                                  </td>
                                  <td className="p-2 text-right font-semibold text-purple-600 dark:text-purple-400 price-responsive whitespace-nowrap">
                                    {formatPrice(reportToUse.openingBalanceAdditions
                                      .filter((add: any) => add.paymentType !== "cash")
                                      .reduce((sum: number, add: any) => sum + Number(add.amount || 0), 0))}
                                  </td>
                                  <td className="p-2 text-right font-semibold text-purple-600 dark:text-purple-400 price-responsive whitespace-nowrap">
                                    {formatPrice(reportToUse.openingBalanceAdditions
                                      .reduce((sum: number, add: any) => sum + Number(add.amount || 0), 0))}
                                  </td>
                                </tr>
                              )}
                              <tr className="border-b border-gray-100 dark:border-gray-700 bg-green-50 dark:bg-green-900/10">
                                <td className="p-2 font-semibold text-gray-800 dark:text-white text-xs sm:text-sm">
                                  Sales
                                </td>
                                <td className="p-2 text-right font-semibold text-green-600 dark:text-green-400 price-responsive whitespace-nowrap">
                                  {formatPrice(reportToUse.sales?.cash || 0)}
                                </td>
                                <td className="p-2 text-right font-semibold text-green-600 dark:text-green-400 price-responsive whitespace-nowrap">
                                  {formatPrice(reportToUse.sales?.bank_transfer || 0)}
                                </td>
                                <td className="p-2 text-right font-semibold text-green-600 dark:text-green-400 price-responsive whitespace-nowrap">
                                  {formatPrice(reportToUse.sales?.total || 0)}
                                </td>
                              </tr>
                              <tr className="border-b border-gray-100 dark:border-gray-700 bg-orange-50 dark:bg-orange-900/10">
                                <td className="p-2 font-semibold text-gray-800 dark:text-white text-xs sm:text-sm">
                                  Purchases
                                </td>
                                <td className="p-2 text-right font-semibold text-orange-600 dark:text-orange-400 price-responsive whitespace-nowrap">
                                  -{formatPrice(reportToUse.purchases?.cash || 0)}
                                </td>
                                <td className="p-2 text-right font-semibold text-orange-600 dark:text-orange-400 price-responsive whitespace-nowrap">
                                  -{formatPrice(reportToUse.purchases?.bank_transfer || 0)}
                                </td>
                                <td className="p-2 text-right font-semibold text-orange-600 dark:text-orange-400 price-responsive whitespace-nowrap">
                                  -{formatPrice(reportToUse.purchases?.total || 0)}
                                </td>
                              </tr>
                              <tr className="border-b border-gray-100 dark:border-gray-700 bg-red-50 dark:bg-red-900/10">
                                <td className="p-2 font-semibold text-gray-800 dark:text-white text-xs sm:text-sm">
                                  Expenses
                                </td>
                                <td className="p-2 text-right font-semibold text-red-600 dark:text-red-400 price-responsive whitespace-nowrap">
                                  -{formatPrice(reportToUse.expenses?.cash || 0)}
                                </td>
                                <td className="p-2 text-right font-semibold text-red-600 dark:text-red-400 price-responsive whitespace-nowrap">
                                  -{formatPrice(reportToUse.expenses?.bank_transfer || 0)}
                                </td>
                                <td className="p-2 text-right font-semibold text-red-600 dark:text-red-400 price-responsive whitespace-nowrap">
                                  -{formatPrice(reportToUse.expenses?.total || 0)}
                                </td>
                              </tr>
                              <tr className="bg-gray-50 dark:bg-gray-900/20">
                                <td className="p-2 font-bold text-gray-800 dark:text-white text-xs sm:text-sm">
                                  Closing Balance
                                </td>
                                <td className="p-2 text-right font-bold text-green-600 dark:text-green-400 price-responsive whitespace-nowrap">
                                  {formatPrice(reportToUse.closingBalance?.cash || 0)}
                                </td>
                                <td className="p-2 text-right font-bold text-green-600 dark:text-green-400 price-responsive whitespace-nowrap">
                                  {formatPrice(reportToUse.closingBalance?.banks?.reduce((sum: number, bank: any) => sum + Number(bank.balance || 0), 0) || 
                                    reportToUse.closingBalance?.cards?.reduce((sum: number, card: any) => sum + (card.balance || 0), 0) || 0)}
                                </td>
                                <td className="p-2 text-right font-bold text-green-600 dark:text-green-400 price-responsive whitespace-nowrap">
                                  {formatPrice(reportToUse.closingBalance?.total || 0)}
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
                      {filteredPurchases.map((purchaseRow: any, index: number) => {
                        if (!purchaseRow || !purchaseRow.id) return null;
                        
                        // Backend sends payment rows with paymentAmount and paymentDate
                        // If it's already a payment row (has paymentAmount), use it directly
                        // Otherwise, treat as legacy purchase format
                        const isPaymentRow = purchaseRow.paymentAmount !== undefined;
                        const paymentDate = isPaymentRow 
                          ? (purchaseRow.paymentDate ? new Date(purchaseRow.paymentDate) : (purchaseRow.date ? new Date(purchaseRow.date) : new Date()))
                          : (purchaseRow.date ? new Date(purchaseRow.date) : (purchaseRow.createdAt ? new Date(purchaseRow.createdAt) : new Date()));
                        
                        const displayAmount = isPaymentRow 
                          ? purchaseRow.paymentAmount 
                          : (purchaseRow.total || 0);
                        
                        const paymentType = isPaymentRow 
                          ? purchaseRow.paymentType 
                          : 'cash';
                        
                        const paymentIndex = isPaymentRow ? purchaseRow.paymentIndex : 0;
                        const hasMultiplePayments = isPaymentRow && paymentIndex > 0;
                        
                        const items = (purchaseRow.items || []) as Array<{ productName: string; quantity: number }>;
                        
                        return (
                          <tr
                            key={isPaymentRow ? `${purchaseRow.id}-payment-${paymentIndex}-${index}` : `${purchaseRow.id}-${index}`}
                            className="border-b border-gray-100 dark:border-gray-700"
                          >
                            <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {paymentDate.toLocaleString('en-US', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                              {hasMultiplePayments && (
                                <span className="text-xs text-gray-500 ml-1">(Payment {paymentIndex + 1})</span>
                              )}
                            </td>
                            <td className="p-2 text-gray-700 dark:text-gray-300">
                              {purchaseRow.supplierName || "N/A"}
                            </td>
                            <td className="p-2 text-gray-700 dark:text-gray-300 max-w-[200px]">
                              <div className="line-clamp-2 truncate">
                                {items.length > 0 
                                  ? items.map((item) => `${item.productName} (${item.quantity})`).join(", ")
                                  : "N/A"}
                              </div>
                            </td>
                            <td className="p-2 text-right font-semibold text-gray-800 dark:text-white whitespace-nowrap">
                              <div className="price-responsive">Rs. {Number(displayAmount || 0).toFixed(2)}</div>
                              <div className="text-xs text-gray-500 mt-1">
                                {paymentType.toUpperCase()}
                              </div>
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
                          {(filteredSales || []).map((paymentRow: any, index: number) => {
                            if (!paymentRow || !paymentRow.id) return null;
                            
                            // Backend sends payment rows with paymentAmount and paymentDate
                            // If it's already a payment row (has paymentAmount), use it directly
                            // Otherwise, treat as legacy sale format
                            const isPaymentRow = paymentRow.paymentAmount !== undefined;
                            const paymentDate = isPaymentRow 
                              ? (paymentRow.paymentDate ? new Date(paymentRow.paymentDate) : (paymentRow.date ? new Date(paymentRow.date) : new Date()))
                              : (paymentRow.date ? new Date(paymentRow.date) : (paymentRow.createdAt ? new Date(paymentRow.createdAt) : new Date()));
                            
                            const displayAmount = isPaymentRow 
                              ? paymentRow.paymentAmount 
                              : (paymentRow.total || 0);
                            
                            const paymentType = isPaymentRow 
                              ? paymentRow.paymentType 
                              : (paymentRow.paymentType || 'cash');
                            
                            const paymentIndex = isPaymentRow ? paymentRow.paymentIndex : 0;
                            const hasMultiplePayments = isPaymentRow && paymentIndex > 0;
                            
                            return (
                              <tr
                                key={isPaymentRow ? `${paymentRow.id}-payment-${paymentIndex}-${index}` : `${paymentRow.id}-${index}`}
                                className="border-b border-gray-100 dark:border-gray-700"
                              >
                                <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                  {paymentRow.billNumber || ""}
                                  {hasMultiplePayments && (
                                    <span className="text-xs text-gray-500 ml-1">(Payment {paymentIndex + 1})</span>
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
                                    {paymentRow.customerName || "Walk-in"}
                                  </div>
                                </td>
                                <td className="p-2 text-right font-semibold text-gray-800 dark:text-white whitespace-nowrap">
                                  <div>Rs. {Number(displayAmount || 0).toFixed(2)}</div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    {paymentType.toUpperCase()}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
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
                              <td className="p-2 text-right font-semibold text-gray-800 dark:text-white whitespace-nowrap price-responsive">
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
