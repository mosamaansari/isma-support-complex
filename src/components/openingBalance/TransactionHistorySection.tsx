import { useState, useEffect } from "react";
import Button from "../ui/button/Button";
import api from "../../services/api";
import { useData } from "../../context/DataContext";
import DatePicker from "../form/DatePicker";
import Label from "../form/Label";
import { getTodayDate, formatDateToString } from "../../utils/dateHelpers";

interface Transaction {
  id: string;
  date: string;
  type: "income" | "expense";
  amount: number;
  paymentType: "cash" | "bank_transfer";
  bankAccountId?: string;
  bankAccount?: {
    bankName: string;
    accountNumber: string;
  };
  description?: string;
  source: string;
  sourceId?: string;
  userName: string;
  createdAt: string;
  beforeBalance?: number | null;
  afterBalance?: number | null;
  changeAmount?: number | null;
}

interface DailyGroup {
  date: string;
  cash: {
    income: number;
    expense: number;
    net: number;
  };
  banks: Array<{
    bankAccountId: string;
    bankName: string;
    accountNumber: string;
    income: number;
    expense: number;
    net: number;
  }>;
  total: {
    income: number;
    expense: number;
    net: number;
  };
  transactions: Transaction[];
}

interface TransactionHistorySectionProps {
  type: "cash" | "bank" | "total" | "banks";
  bankAccountId?: string;
  bankName?: string;
  onClose: () => void;
}

export default function TransactionHistorySection({
  type,
  bankAccountId,
  bankName,
  onClose,
}: TransactionHistorySectionProps) {
  const { bankAccounts } = useData();
  const [dailyGroups, setDailyGroups] = useState<DailyGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const today = getTodayDate();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [openingBalances, setOpeningBalances] = useState<Record<string, any>>({});
  const [closingBalances, setClosingBalances] = useState<Record<string, any>>({});

  useEffect(() => {
    loadTransactions();
    loadOpeningAndClosingBalances();
  }, [type, bankAccountId, startDate, endDate]);

  const loadOpeningAndClosingBalances = async () => {
    try {
      // Load opening and closing balances for the date range
      const openingBalancesMap: Record<string, any> = {};
      const closingBalancesMap: Record<string, any> = {};

      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const current = new Date(start);

        while (current <= end) {
          // Use local date components to avoid timezone issues
          const year = current.getFullYear();
          const month = String(current.getMonth() + 1).padStart(2, '0');
          const day = String(current.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          
          try {
            // Opening balance should ALWAYS be previous day's closing balance
            // Not the opening balance record (which might have been updated during the day)
            const previousDate = new Date(current);
            previousDate.setDate(previousDate.getDate() - 1);
            const prevYear = previousDate.getFullYear();
            const prevMonth = String(previousDate.getMonth() + 1).padStart(2, '0');
            const prevDay = String(previousDate.getDate()).padStart(2, '0');
            const prevDateStr = `${prevYear}-${prevMonth}-${prevDay}`;
            
            try {
              const prevClosing = await api.getClosingBalance(prevDateStr);
              if (prevClosing) {
                // Use previous day's closing as today's opening (this is the actual opening balance)
                openingBalancesMap[dateStr] = {
                  cashBalance: prevClosing.cashBalance || 0,
                  bankBalances: prevClosing.bankBalances || [],
                  cardBalances: prevClosing.cardBalances || [],
                };
              } else {
                // If no previous closing, check if there's an opening balance record set for this date
                // (for the very first day when there's no previous closing)
                try {
                  const openingBalance = await api.getOpeningBalance(dateStr);
                  if (openingBalance) {
                    openingBalancesMap[dateStr] = {
                      cashBalance: openingBalance.cashBalance || 0,
                      bankBalances: openingBalance.bankBalances || [],
                      cardBalances: openingBalance.cardBalances || [],
                    };
                  }
                } catch (e) {
                  // No opening balance record either
                }
              }
            } catch (e) {
              // Previous day closing not found, try opening balance record for this date
              try {
                const openingBalance = await api.getOpeningBalance(dateStr);
                if (openingBalance) {
                  openingBalancesMap[dateStr] = {
                    cashBalance: openingBalance.cashBalance || 0,
                    bankBalances: openingBalance.bankBalances || [],
                    cardBalances: openingBalance.cardBalances || [],
                  };
                }
              } catch (e2) {
                // No opening balance found
              }
            }
          } catch (e) {
            // Error loading opening balance
          }

          try {
            const closingBalance = await api.getClosingBalance(dateStr);
            if (closingBalance) {
              closingBalancesMap[dateStr] = closingBalance;
            }
          } catch (e) {
            // Closing balance not found for this date
          }

          current.setDate(current.getDate() + 1);
        }
      }

      setOpeningBalances(openingBalancesMap);
      setClosingBalances(closingBalancesMap);
    } catch (error) {
      console.error("Error loading opening/closing balances:", error);
    }
  };

  const loadTransactions = async () => {
    setLoading(true);
    try {
      if (type === "total") {
        // Get all transactions grouped by day
        const data = await api.getAllTransactionsGroupedByDay(
          startDate || undefined,
          endDate || undefined
        );
        console.log("Total transactions grouped:", data);
        let groups = Array.isArray(data) ? data : [];
        
        // If date range is provided, ensure all dates in range are included
        if (startDate && endDate && groups.length > 0) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          const existingDates = new Set(groups.map(g => g.date));
          const allDates: string[] = [];
          const current = new Date(start);
          
          while (current <= end) {
            const dateStr = formatDateToString(current);
            allDates.push(dateStr);
            current.setDate(current.getDate() + 1);
          }
          
          // Add empty groups for missing dates
          const missingDates = allDates.filter(d => !existingDates.has(d));
          const emptyGroups = missingDates.map(date => ({
            date,
            cash: { income: 0, expense: 0, net: 0 },
            banks: [],
            total: { income: 0, expense: 0, net: 0 },
            transactions: [],
          }));
          
          groups = [...groups, ...emptyGroups].sort((a, b) => 
            new Date(a.date).getTime() - new Date(b.date).getTime()
          );
        }
        
        setDailyGroups(groups);
      } else if (type === "cash") {
        // Get cash transactions and group by day
        const transactions: Transaction[] = await api.getCashTransactions(
          startDate || undefined,
          endDate || undefined
        );
        console.log("Cash transactions:", transactions);
        // Ensure transactions is an array
        const transactionsArray = Array.isArray(transactions) ? transactions : [];
        const grouped = groupTransactionsByDay(transactionsArray);
        console.log("Grouped cash transactions:", grouped);
        setDailyGroups(grouped);
      } else if (type === "bank" && bankAccountId) {
        // Get bank transactions for specific bank and group by day
        const transactions: Transaction[] = await api.getBankTransactions(
          bankAccountId,
          startDate || undefined,
          endDate || undefined
        );
        console.log("Bank transactions:", transactions);
        // Ensure transactions is an array
        const transactionsArray = Array.isArray(transactions) ? transactions : [];
        const grouped = groupTransactionsByDay(transactionsArray);
        console.log("Grouped bank transactions:", grouped);
        setDailyGroups(grouped);
      } else if (type === "banks") {
        // Get all bank transactions (all banks combined) - exclude cash
        // We'll get all transactions grouped and filter out cash
        const data = await api.getAllTransactionsGroupedByDay(
          startDate || undefined,
          endDate || undefined
        );
        console.log("All transactions for banks filter:", data);
        // Filter to only show bank transactions
        if (Array.isArray(data)) {
          let filteredData = data.map((dayGroup) => ({
            ...dayGroup,
            transactions: dayGroup.transactions.filter((t: any) => t.paymentType === "bank_transfer"),
            cash: { income: 0, expense: 0, net: 0 }, // Remove cash from summary
            total: {
              income: dayGroup.total.income - dayGroup.cash.income,
              expense: dayGroup.total.expense - dayGroup.cash.expense,
              net: dayGroup.total.net - dayGroup.cash.net,
            },
          }));
          
          // If date range is provided, ensure all dates in range are included
          if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const existingDates = new Set(filteredData.map(g => g.date));
            const allDates: string[] = [];
            const current = new Date(start);
            
            while (current <= end) {
              const dateStr = formatDateToString(current);
              allDates.push(dateStr);
              current.setDate(current.getDate() + 1);
            }
            
            // Add empty groups for missing dates
            const missingDates = allDates.filter(d => !existingDates.has(d));
            const emptyGroups = missingDates.map(date => ({
              date,
              cash: { income: 0, expense: 0, net: 0 },
              banks: [],
              total: { income: 0, expense: 0, net: 0 },
              transactions: [],
            }));
            
            filteredData = [...filteredData, ...emptyGroups].sort((a, b) => 
              new Date(a.date).getTime() - new Date(b.date).getTime()
            );
          }
          
          setDailyGroups(filteredData);
        } else {
          setDailyGroups([]);
        }
      }
    } catch (error) {
      console.error("Error loading transactions:", error);
      setDailyGroups([]);
    } finally {
      setLoading(false);
    }
  };

  const groupTransactionsByDay = (transactions: Transaction[]): DailyGroup[] => {
    // Filter transactions by date range if provided
    let filteredTransactions = transactions;
    if (startDate || endDate) {
      filteredTransactions = transactions.filter((transaction) => {
        // Parse transaction date properly to avoid timezone issues
        const txDate = new Date(transaction.date);
        const txYear = txDate.getFullYear();
        const txMonth = txDate.getMonth();
        const txDay = txDate.getDate();
        const txDateOnly = `${txYear}-${String(txMonth + 1).padStart(2, '0')}-${String(txDay).padStart(2, '0')}`;
        
        if (startDate && endDate) {
          return txDateOnly >= startDate && txDateOnly <= endDate;
        } else if (startDate) {
          return txDateOnly >= startDate;
        } else if (endDate) {
          return txDateOnly <= endDate;
        }
        return true;
      });
    }

    const grouped: Record<string, Transaction[]> = {};
    for (const transaction of filteredTransactions) {
      // Parse transaction date properly to avoid timezone issues
      const txDate = new Date(transaction.date);
      const txYear = txDate.getFullYear();
      const txMonth = txDate.getMonth();
      const txDay = txDate.getDate();
      const dateStr = `${txYear}-${String(txMonth + 1).padStart(2, '0')}-${String(txDay).padStart(2, '0')}`;
      
      if (!grouped[dateStr]) {
        grouped[dateStr] = [];
      }
      grouped[dateStr].push(transaction);
    }

    // If date range is provided, ensure all dates in range are included (even if no transactions)
    let datesToShow: string[] = [];
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const current = new Date(start);
      while (current <= end) {
        const dateStr = formatDateToString(current);
        datesToShow.push(dateStr);
        current.setDate(current.getDate() + 1);
      }
    } else {
      datesToShow = Object.keys(grouped);
    }

    return datesToShow.map((date) => {
      const dayTransactions = grouped[date] || [];
      let cashIncome = 0;
      let cashExpense = 0;
      const bankTotals: Record<string, { income: number; expense: number }> = {};

      for (const transaction of dayTransactions) {
        const amount = Number(transaction.amount);
        if (transaction.paymentType === "cash") {
          if (transaction.type === "income") {
            cashIncome += amount;
          } else {
            cashExpense += amount;
          }
        } else if (transaction.paymentType === "bank_transfer" && transaction.bankAccountId) {
          if (!bankTotals[transaction.bankAccountId]) {
            bankTotals[transaction.bankAccountId] = { income: 0, expense: 0 };
          }
          if (transaction.type === "income") {
            bankTotals[transaction.bankAccountId].income += amount;
          } else {
            bankTotals[transaction.bankAccountId].expense += amount;
          }
        }
      }

      const cashNet = cashIncome - cashExpense;
      let totalBankIncome = 0;
      let totalBankExpense = 0;
      const bankDetails: DailyGroup["banks"] = [];

      for (const [bankAccountId, totals] of Object.entries(bankTotals)) {
        const bank = bankAccounts.find((b) => b.id === bankAccountId);
        const transactionWithBank = dayTransactions.find(
          (t) => t.bankAccountId === bankAccountId && t.bankAccount
        );
        const bankName = bank?.bankName || transactionWithBank?.bankAccount?.bankName || "Unknown";
        const accountNumber = bank?.accountNumber || transactionWithBank?.bankAccount?.accountNumber || "";
        const net = totals.income - totals.expense;
        totalBankIncome += totals.income;
        totalBankExpense += totals.expense;
        bankDetails.push({
          bankAccountId,
          bankName,
          accountNumber,
          income: totals.income,
          expense: totals.expense,
          net,
        });
      }

      const totalIncome = cashIncome + totalBankIncome;
      const totalExpense = cashExpense + totalBankExpense;
      const totalNet = totalIncome - totalExpense;

      return {
        date,
        cash: {
          income: cashIncome,
          expense: cashExpense,
          net: cashNet,
        },
        banks: bankDetails,
        total: {
          income: totalIncome,
          expense: totalExpense,
          net: totalNet,
        },
        transactions: dayTransactions,
      };
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-PK", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      sale: "Sale Payment",
      sale_payment: "Sale Payment",
      purchase_payment: "Purchase Payment",
      expense: "Expense Payment",
      opening_balance: "Opening Balance",
      closing_balance: "Closing Balance",
      manual_add: "Manual Add",
      add_opening_balance: "Add to Opening Balance",
      opening_balance_deduction: "Deduct from Opening Balance",
      previous_day_balance: "Previous Day Balance",
    };
    return labels[source] || source.charAt(0).toUpperCase() + source.slice(1).replace(/_/g, " ");
  };

  const getTitle = () => {
    if (type === "total") return "Total Transaction History";
    if (type === "cash") return "Cash Transaction History";
    if (type === "banks") return "All Banks Transaction History";
    return `Bank Transaction History - ${bankName || "Bank"}`;
  };

  // Calculate overall totals
  const overallTotalIncome = dailyGroups.reduce((sum, day) => sum + day.total.income, 0);
  const overallTotalExpense = dailyGroups.reduce((sum, day) => sum + day.total.expense, 0);
  const overallTotalNet = overallTotalIncome - overallTotalExpense;

  return (
    <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white">
          {getTitle()}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
        >
          Hide History
        </Button>
      </div>

      {/* Date Filters */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <Label>Start Date</Label>
          <DatePicker
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="Select start date"
          />
        </div>
        <div>
          <Label>End Date</Label>
          <DatePicker
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="Select end date"
          />
        </div>
      </div>

      {/* Overall Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Income</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(overallTotalIncome)}</p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Expense</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(overallTotalExpense)}</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Net Amount</p>
          <p className={`text-xl font-bold ${overallTotalNet >= 0 ? "text-blue-600" : "text-red-600"}`}>
            {formatCurrency(overallTotalNet)}
          </p>
        </div>
      </div>

      {/* Daily Groups */}
      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Loading transactions...</p>
        </div>
      ) : dailyGroups.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">No transactions found</p>
        </div>
      ) : (
        <div className="space-y-6">
          {dailyGroups.map((dayGroup) => (
            <div key={dayGroup.date} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              {/* Day Header */}
              <div className="mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                  {formatDate(dayGroup.date)}
                </h3>
                
                {/* Opening and Closing Balance */}
                <div className="grid grid-cols-2 gap-4 mt-3 mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Opening Balance</p>
                    {openingBalances[dayGroup.date] ? (
                      <div>
                        {type === "cash" || type === "total" ? (
                          <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                            Cash: {formatCurrency(Number(openingBalances[dayGroup.date].cashBalance) || 0)}
                          </p>
                        ) : null}
                        {type === "bank" || type === "banks" || type === "total" ? (
                          <div className="mt-1">
                            {openingBalances[dayGroup.date].bankBalances && Array.isArray(openingBalances[dayGroup.date].bankBalances) ? (
                              (openingBalances[dayGroup.date].bankBalances as any[]).map((bank: any) => {
                                if (type === "bank" && bankAccountId && bank.bankAccountId !== bankAccountId) return null;
                                if (type === "banks" || type === "total") {
                                  return (
                                    <p key={bank.bankAccountId} className="text-xs text-blue-600 dark:text-blue-400">
                                      {bankAccounts.find(b => b.id === bank.bankAccountId)?.bankName || "Bank"}: {formatCurrency(Number(bank.balance) || 0)}
                                    </p>
                                  );
                                }
                                return null;
                              })
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">No opening balance</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Closing Balance</p>
                    {closingBalances[dayGroup.date] ? (
                      <div>
                        {type === "cash" || type === "total" ? (
                          <p className="text-sm font-bold text-purple-600 dark:text-purple-400">
                            Cash: {formatCurrency(Number(closingBalances[dayGroup.date].cashBalance) || 0)}
                          </p>
                        ) : null}
                        {type === "bank" || type === "banks" || type === "total" ? (
                          <div className="mt-1">
                            {closingBalances[dayGroup.date].bankBalances && Array.isArray(closingBalances[dayGroup.date].bankBalances) ? (
                              (closingBalances[dayGroup.date].bankBalances as any[]).map((bank: any) => {
                                if (type === "bank" && bankAccountId && bank.bankAccountId !== bankAccountId) return null;
                                if (type === "banks" || type === "total") {
                                  return (
                                    <p key={bank.bankAccountId} className="text-xs text-purple-600 dark:text-purple-400">
                                      {bankAccounts.find(b => b.id === bank.bankAccountId)?.bankName || "Bank"}: {formatCurrency(Number(bank.balance) || 0)}
                                    </p>
                                  );
                                }
                                return null;
                              })
                            ) : null}
                          </div>
                        ) : null}
                        {type === "total" && closingBalances[dayGroup.date].cardBalances && Array.isArray(closingBalances[dayGroup.date].cardBalances) && closingBalances[dayGroup.date].cardBalances.length > 0 ? (
                          <div className="mt-1">
                            {(closingBalances[dayGroup.date].cardBalances as any[]).map((card: any) => (
                              <p key={card.cardId} className="text-xs text-purple-600 dark:text-purple-400">
                                Card: {formatCurrency(Number(card.balance) || 0)}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">No closing balance</p>
                    )}
                  </div>
                </div>

                {/* Daily Summary */}
                <div className="grid grid-cols-3 gap-4 mt-2">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Cash Net</p>
                    <p className={`font-semibold ${dayGroup.cash.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(dayGroup.cash.net)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Banks Net</p>
                    <p className={`font-semibold ${dayGroup.total.net - dayGroup.cash.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(dayGroup.total.net - dayGroup.cash.net)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Net</p>
                    <p className={`font-semibold ${dayGroup.total.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatCurrency(dayGroup.total.net)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Cash Details */}
              {(type === "cash" || type === "total") && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Cash</h4>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <div className="text-sm">
                      <span className="text-gray-500">Income: </span>
                      <span className="text-green-600 font-semibold">{formatCurrency(dayGroup.cash.income)}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-500">Expense: </span>
                      <span className="text-red-600 font-semibold">{formatCurrency(dayGroup.cash.expense)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bank Details */}
              {(type === "total" || type === "banks" || (type === "bank" && bankAccountId)) && dayGroup.banks.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Banks</h4>
                  {dayGroup.banks.map((bank) => (
                    <div key={bank.bankAccountId} className="mb-2 p-2 bg-gray-50 dark:bg-gray-800 rounded">
                      <p className="text-sm font-medium text-gray-800 dark:text-white">
                        {bank.bankName} ({bank.accountNumber})
                      </p>
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        <div className="text-xs">
                          <span className="text-gray-500">Income: </span>
                          <span className="text-green-600">{formatCurrency(bank.income)}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-gray-500">Expense: </span>
                          <span className="text-red-600">{formatCurrency(bank.expense)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Transactions Table */}
              {dayGroup.transactions && dayGroup.transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="p-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                          Time
                        </th>
                        <th className="p-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                          Type
                        </th>
                        <th className="p-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                          Source
                        </th>
                        <th className="p-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                          Description
                        </th>
                        {type === "total" && (
                          <th className="p-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                            Payment Type
                          </th>
                        )}
                        {type === "total" && (
                          <th className="p-2 text-left text-xs font-medium text-gray-700 dark:text-gray-300">
                            Bank
                          </th>
                        )}
                        <th className="p-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                          Before Balance
                        </th>
                        <th className="p-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                          Change
                        </th>
                        <th className="p-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                          After Balance
                        </th>
                        <th className="p-2 text-right text-xs font-medium text-gray-700 dark:text-gray-300">
                          User
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Opening Balance Row - Show first if opening balance exists */}
                      {openingBalances[dayGroup.date] && (() => {
                        const opening = openingBalances[dayGroup.date];
                        if (type === "cash") {
                          const openingCash = Number(opening.cashBalance) || 0;
                          return (
                            <tr key={`opening-${dayGroup.date}`} className="border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
                              <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs">
                                00:00:00
                              </td>
                              <td className="p-2">
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200">
                                  Opening
                                </span>
                              </td>
                              <td className="p-2 text-gray-700 dark:text-gray-300">Opening Balance</td>
                              <td className="p-2 text-gray-700 dark:text-gray-300">Previous Day Closing Balance</td>
                              <td className="p-2 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">-</td>
                              <td className="p-2 text-right text-blue-600 dark:text-blue-400 font-semibold whitespace-nowrap">
                                {formatCurrency(openingCash)}
                              </td>
                              <td className="p-2 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                {formatCurrency(openingCash)}
                              </td>
                              <td className="p-2 text-right text-gray-600 dark:text-gray-400 text-xs">System</td>
                            </tr>
                          );
                        } else if (type === "bank" && bankAccountId) {
                          const bankBalance = opening.bankBalances?.find((b: any) => b.bankAccountId === bankAccountId);
                          const openingBank = Number(bankBalance?.balance) || 0;
                          return (
                            <tr key={`opening-${dayGroup.date}`} className="border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
                              <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs">
                                00:00:00
                              </td>
                              <td className="p-2">
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200">
                                  Opening
                                </span>
                              </td>
                              <td className="p-2 text-gray-700 dark:text-gray-300">Opening Balance</td>
                              <td className="p-2 text-gray-700 dark:text-gray-300">Previous Day Closing Balance</td>
                              
                              <td className="p-2 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">-</td>
                              <td className="p-2 text-right text-blue-600 dark:text-blue-400 font-semibold whitespace-nowrap">
                                {formatCurrency(openingBank)}
                              </td>
                              <td className="p-2 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                {formatCurrency(openingBank)}
                              </td>
                              <td className="p-2 text-right text-gray-600 dark:text-gray-400 text-xs">System</td>
                            </tr>
                          );
                        } else if (type === "total" || type === "banks") {
                          // For total/banks, show opening balance summary
                          const openingCash = Number(opening.cashBalance) || 0;
                          const openingBanks = opening.bankBalances || [];
                          const totalOpening = openingCash + openingBanks.reduce((sum: number, b: any) => sum + (Number(b.balance) || 0), 0);
                          return (
                            <tr key={`opening-${dayGroup.date}`} className="border-b border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
                              <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap text-xs">
                                00:00:00
                              </td>
                              <td className="p-2">
                                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200">
                                  Opening
                                </span>
                              </td>
                              <td className="p-2 text-gray-700 dark:text-gray-300">Opening Balance</td>
                              <td className="p-2 text-gray-700 dark:text-gray-300">Previous Day Closing Balance</td>
                              <td className="p-2 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">-</td>
                             
                              <td className="p-2 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">-</td>
                              <td className="p-2 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">-</td>
                              <td className="p-2 text-right text-blue-600 dark:text-blue-400 font-semibold whitespace-nowrap">
                                {formatCurrency(totalOpening)}
                              </td>
                              <td className="p-2 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap">
                                {formatCurrency(totalOpening)}
                              </td>
                              <td className="p-2 text-right text-gray-600 dark:text-gray-400 text-xs">System</td>
                            </tr>
                          );
                        }
                        return null;
                      })()}
                      {dayGroup.transactions
                        .filter((t) => {
                          if (type === "cash") return t.paymentType === "cash";
                          if (type === "bank" && bankAccountId) return t.bankAccountId === bankAccountId;
                          if (type === "banks") return t.paymentType === "bank_transfer";
                          return true;
                        })
                        .sort((a, b) => {
                          // Sort by time (createdAt)
                          const timeA = new Date(a.createdAt || a.date).getTime();
                          const timeB = new Date(b.createdAt || b.date).getTime();
                          return timeA - timeB;
                        })
                        .map((transaction) => (
                          <tr
                            key={transaction.id}
                            className={`border-b border-gray-100 dark:border-gray-700 ${
                              transaction.type === "income"
                                ? "bg-green-50 dark:bg-green-900/10"
                                : "bg-red-50 dark:bg-red-900/10"
                            }`}
                          >
                            <td className="p-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                              {new Date(transaction.createdAt || transaction.date).toLocaleString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit'
                              })}
                            </td>
                            <td className="p-2">
                              <span
                                className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                  transaction.type === "income"
                                    ? "bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200"
                                    : "bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200"
                                }`}
                              >
                                {transaction.type === "income" ? "Income" : "Expense"}
                              </span>
                            </td>
                            <td className="p-2 text-gray-700 dark:text-gray-300">
                              {getSourceLabel(transaction.source)}
                            </td>
                            <td className="p-2 text-gray-700 dark:text-gray-300 max-w-xs">
                              <div className="truncate" title={transaction.description || ""}>
                                {transaction.description || "-"}
                              </div>
                            </td>
                            {type === "total" && (
                              <td className="p-2 text-gray-700 dark:text-gray-300 capitalize">
                                {transaction.paymentType === "cash" ? "Cash" : "Bank Transfer"}
                              </td>
                            )}
                            {type === "total" && (
                              <td className="p-2 text-gray-700 dark:text-gray-300">
                                {transaction.bankAccount ? (
                                  <div className="text-xs">
                                    <div>{transaction.bankAccount.bankName}</div>
                                    <div className="text-gray-500">{transaction.bankAccount.accountNumber}</div>
                                  </div>
                                ) : (
                                  "-"
                                )}
                              </td>
                            )}
                            <td className="p-2 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap font-medium">
                              {transaction.beforeBalance !== null && transaction.beforeBalance !== undefined
                                ? formatCurrency(Number(transaction.beforeBalance))
                                : openingBalances[dayGroup.date] && type === "cash" 
                                  ? formatCurrency(Number(openingBalances[dayGroup.date].cashBalance) || 0)
                                  : openingBalances[dayGroup.date] && type === "bank" && bankAccountId
                                    ? formatCurrency(Number(openingBalances[dayGroup.date].bankBalances?.find((b: any) => b.bankAccountId === bankAccountId)?.balance) || 0)
                                    : "-"}
                            </td>
                            <td className={`p-2 text-right font-semibold whitespace-nowrap ${
                              transaction.type === "income"
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}>
                              {transaction.type === "income" ? "+" : "-"}
                              {formatCurrency(Number(transaction.amount))}
                            </td>
                            <td className="p-2 text-right text-gray-600 dark:text-gray-400 whitespace-nowrap font-medium">
                              {transaction.afterBalance !== null && transaction.afterBalance !== undefined
                                ? formatCurrency(Number(transaction.afterBalance))
                                : transaction.beforeBalance !== null && transaction.beforeBalance !== undefined
                                  ? formatCurrency(Number(transaction.beforeBalance) + (transaction.type === "income" ? Number(transaction.amount) : -Number(transaction.amount)))
                                  : "-"}
                            </td>
                            <td className="p-2 text-right text-gray-600 dark:text-gray-400 text-xs">
                              {transaction.userName || "-"}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-4 text-sm text-gray-500">
                  No transactions found for this day
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
