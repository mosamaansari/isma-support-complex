import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useAlert } from "../../context/AlertContext";
import { useData } from "../../context/DataContext";
import Button from "../../components/ui/button/Button";
import { ChevronLeftIcon } from "../../icons";
import api from "../../services/api";
import { getTodayDate } from "../../utils/dateHelpers";
import TransactionHistorySection from "../../components/openingBalance/TransactionHistorySection";
import AddCashModal from "../../components/modals/AddCashModal";
import DatePicker from "../../components/form/DatePicker";
import Label from "../../components/form/Label";
import { formatCompleteAmount } from "../../utils/priceHelpers";
import { hasResourcePermission } from "../../utils/permissions";


export default function OpeningBalance() {
  const { showError } = useAlert();
  const { bankAccounts, refreshBankAccounts, currentUser } = useData();
  const navigate = useNavigate();
  const [date, setDate] = useState(getTodayDate());
  const [cashBalance, setCashBalance] = useState<number>(0);
  const [bankBalances, setBankBalances] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [, setExistingBalance] = useState<any>(null);
  const [showAddCashModal, setShowAddCashModal] = useState(false);
  const [transactionType, setTransactionType] = useState<"cash" | "bank" | undefined>(undefined);
  const [selectedBankId, setSelectedBankId] = useState<string | undefined>();
  const [selectedBankName, setSelectedBankName] = useState<string | undefined>();
  const [showHistory, setShowHistory] = useState(false);
  const [historyType, setHistoryType] = useState<"cash" | "bank" | "total" | "banks">("cash");
  const [historyBankId, setHistoryBankId] = useState<string | undefined>();
  const [historyBankName, setHistoryBankName] = useState<string | undefined>();
  const [previousDayBalance, setPreviousDayBalance] = useState<{
    cashBalance: number;
    bankBalances: Array<{ bankAccountId: string; balance: number }>;
  }>({
    cashBalance: 0,
    bankBalances: [],
  });

  useEffect(() => {
    refreshBankAccounts();
    loadOpeningBalance();
    loadPreviousDayBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const loadOpeningBalance = async () => {
    setLoading(true);
    try {
      const balance = await api.getOpeningBalance(date);
      if (balance) {
        setExistingBalance(balance);
        setCashBalance(Number(balance.cashBalance) || 0);

        // Load bank balances
        const bankBalancesMap: Record<string, number> = {};
        if (balance.bankBalances && Array.isArray(balance.bankBalances)) {
          for (const bankBalance of balance.bankBalances as any[]) {
            if (bankBalance.bankAccountId) {
              bankBalancesMap[bankBalance.bankAccountId] = Number(bankBalance.balance || 0);
            }
          }
        }
        setBankBalances(bankBalancesMap);
      } else {
        setExistingBalance(null);
        setCashBalance(0);
        setBankBalances({});
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        setExistingBalance(null);
        setCashBalance(0);
        setBankBalances({});
      } else {
        console.error("Error loading opening balance:", error);
        showError("Failed to load opening balance");
      }
    } finally {
      setLoading(false);
    }
  };

  const loadPreviousDayBalance = async () => {
    try {
      const previous = await api.getPreviousDayClosingBalance(date);
      if (previous) {
        setPreviousDayBalance({
          cashBalance: previous.cashBalance || 0,
          bankBalances: previous.bankBalances || [],
        });
      } else {
        // If no data, set to default values
        setPreviousDayBalance({
          cashBalance: 0,
          bankBalances: [],
        });
      }
    } catch (error) {
      console.error("Error loading previous day balance:", error);
      // On error, set to default values
      setPreviousDayBalance({
        cashBalance: 0,
        bankBalances: [],
      });
    }
  };

  const totalBankBalance = Object.values(bankBalances).reduce((sum, balance) => sum + balance, 0);
  const totalBalance = cashBalance + totalBankBalance;

  const formatCurrency = (amount: number) => {
    // Use formatCompleteAmount to show complete amounts (without K/M abbreviation)
    return formatCompleteAmount(amount);
  };

  const handleCardClick = (type: "cash" | "bank" | "total" | "banks", bankId?: string, bankName?: string) => {
    setHistoryType(type as "cash" | "bank" | "total");
    setHistoryBankId(bankId);
    setHistoryBankName(bankName);
    setShowHistory(true);
  };

  return (
    <>
      <PageMeta
        title="Daily Opening Balance | Isma Sports Complex"
        description="View and manage daily opening balance"
      />

      {!currentUser || !hasResourcePermission(currentUser.role, 'opening_balance:view', currentUser.permissions) ? (
        <div className="p-8 text-center">
          <p className="text-red-600 dark:text-red-400">
            Access denied. Insufficient permissions to view opening balance.
          </p>
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={() => navigate("/reports")}>
              <ChevronLeftIcon className="w-4 h-4 mr-2" />
              Back to Reports
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="mb-6">

            <Button variant="outline" size="sm" onClick={() => navigate("/reports")}>
              <ChevronLeftIcon className="w-4 h-4 mr-2" />
              Back to Reports
            </Button>
          </div>

          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm dark:bg-gray-800 p-6">
              <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
                  Daily Opening Balance
                </h1>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="mb-0 whitespace-nowrap">Select Date:</Label>
                    <DatePicker
                      name="reportDate"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </div>
                  {hasResourcePermission(currentUser.role, 'opening_balance:create', currentUser.permissions) && (
                    <Button
                      onClick={() => {
                        setShowAddCashModal(true);
                        setTransactionType(undefined);
                        setSelectedBankId(undefined);
                        setSelectedBankName(undefined);
                      }}
                      size="sm"
                    >
                      Add Opening Balance
                    </Button>
                  )}
                </div>
              </div>

              {loading ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">Loading...</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Previous Day Balance - At Top */}
                  <div className="bg-gray-50 dark:bg-gray-900/20 rounded-lg p-6 border-2 border-gray-200 dark:border-gray-800">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white mb-4">
                      Previous Day Closing Balance
                    </h2>

                    {/* Cash Balance - Always Show */}
                    <div className="mb-4">
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Cash Balance</p>
                        <p className="text-2xl font-bold text-blue-600">
                          {formatCurrency(previousDayBalance.cashBalance)}
                        </p>
                      </div>
                    </div>

                    {/* Bank Balances - Show All Banks */}
                    <div>
                      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                        Bank-wise Balances
                      </p>
                      {bankAccounts.length > 0 ? (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {bankAccounts.map((bank) => {
                              const bankBalance = previousDayBalance.bankBalances.find(
                                (b) => b.bankAccountId === bank.id
                              );
                              const balance = bankBalance?.balance || 0;
                              return (
                                <div
                                  key={bank.id}
                                  className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800"
                                >
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                    {bank.bankName}
                                  </p>
                                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                                    {bank.accountNumber}
                                  </p>
                                  <p className="text-lg font-bold text-green-600">
                                    {formatCurrency(balance)}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                          {/* Total Bank Balance */}
                          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex justify-between items-center">
                              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                Total Bank Balance:
                              </p>
                              <p className="text-lg font-bold text-gray-800 dark:text-white">
                                {formatCurrency(
                                  previousDayBalance.bankBalances.reduce(
                                    (sum, b) => sum + (b.balance || 0),
                                    0
                                  )
                                )}
                              </p>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                          <p className="text-sm text-yellow-800 dark:text-yellow-200">
                            No bank accounts found. Please add bank accounts in settings.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Grand Total - Always Show */}
                    <div className="mt-4 pt-4 border-t-2 border-gray-300 dark:border-gray-600">
                      <div className="flex justify-between items-center">
                        <p className="text-base font-bold text-gray-800 dark:text-white">
                          Grand Total:
                        </p>
                        <p className="text-2xl font-bold text-purple-600">
                          {formatCurrency(
                            previousDayBalance.cashBalance +
                            previousDayBalance.bankBalances.reduce(
                              (sum, b) => sum + (b.balance || 0),
                              0
                            )
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Current Day Balances - 3 Column Layout */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Left: Cash Balance Card */}
                    <div
                      onClick={() => handleCardClick("cash")}
                      className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border-2 border-blue-200 dark:border-blue-800"
                    >
                      <div className="flex flex-col justify-between h-full">
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Cash Balance</p>
                          <p className="text-3xl font-bold text-blue-600">{formatCurrency(cashBalance)}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Click to view history</p>
                        </div>
                        <div className="mt-4">
                          {hasResourcePermission(currentUser.role, 'opening_balance:create', currentUser.permissions) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowAddCashModal(true);
                                setTransactionType("cash");
                                setSelectedBankId(undefined);
                                setSelectedBankName(undefined);
                              }}
                              className="w-full"
                            >
                              Add Cash
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Middle: Total Bank Balances Card */}
                    <div
                      onClick={() => handleCardClick("banks")}
                      className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors border-2 border-green-200 dark:border-green-800"
                    >
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Bank Balance</p>
                        <p className="text-3xl font-bold text-green-600">{formatCurrency(totalBankBalance)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Click to view history</p>
                      </div>
                    </div>

                    {/* Right: Total Balance Card */}
                    <div
                      onClick={() => handleCardClick("total")}
                      className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-6 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors border-2 border-purple-200 dark:border-purple-800"
                    >
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Balance</p>
                        <p className="text-3xl font-bold text-purple-600">{formatCurrency(totalBalance)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Click to view all history</p>
                      </div>
                    </div>
                  </div>

                  {/* Bank Accounts - Below */}
                  <div>
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                      Bank Accounts
                    </h2>
                    {bankAccounts.length === 0 ? (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                        <p className="text-sm text-yellow-800 dark:text-yellow-200">
                          No bank accounts found. Please add bank accounts in settings.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {bankAccounts.map((bank) => {
                          const bankBalance = bankBalances[bank.id] || 0;
                          return (
                            <div
                              key={bank.id}
                              onClick={() => handleCardClick("bank", bank.id, bank.bankName)}
                              className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors border-2 border-green-200 dark:border-green-800"
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <p className="font-semibold text-gray-800 dark:text-white mb-1">
                                    {bank.bankName}
                                  </p>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                    {bank.accountNumber}
                                  </p>
                                  <p className="text-xl font-bold text-green-600">
                                    {formatCurrency(bankBalance)}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                    Click to view history
                                  </p>
                                </div>
                                {hasResourcePermission(currentUser.role, 'opening_balance:create', currentUser.permissions) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setShowAddCashModal(true);
                                      setTransactionType("bank");
                                      setSelectedBankId(bank.id);
                                      setSelectedBankName(bank.bankName);
                                    }}
                                  >
                                    Add
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Transaction History Section */}
                  {showHistory && (
                    <TransactionHistorySection
                      type={historyType}
                      bankAccountId={historyBankId}
                      bankName={historyBankName}
                      onClose={() => setShowHistory(false)}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Add Cash/Bank Modal */}
          <AddCashModal
            isOpen={showAddCashModal}
            date={date}
            onClose={() => {
              setShowAddCashModal(false);
              setSelectedBankId(undefined);
              setSelectedBankName(undefined);
              setTransactionType(undefined);
            }}
            onSuccess={() => {
              loadOpeningBalance();
              // If history is open, close and reopen to refresh
              if (showHistory) {
                setShowHistory(false);
                setTimeout(() => {
                  handleCardClick(historyType, historyBankId, historyBankName);
                }, 100);
              }
            }}
            type={transactionType}
            bankAccountId={selectedBankId}
            bankName={selectedBankName}
          />
        </>
      )}
    </>
  );
}
