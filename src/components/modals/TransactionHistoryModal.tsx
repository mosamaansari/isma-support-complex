import { useState, useEffect } from "react";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import api from "../../services/api";

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
}

interface TransactionHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "cash" | "bank";
  bankAccountId?: string;
  bankName?: string;
}

export default function TransactionHistoryModal({
  isOpen,
  onClose,
  type,
  bankAccountId,
  bankName,
}: TransactionHistoryModalProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadTransactions();
    }
  }, [isOpen, type, bankAccountId, startDate, endDate]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      let data: Transaction[] = [];
      if (type === "cash") {
        data = await api.getCashTransactions(startDate || undefined, endDate || undefined);
      } else if (type === "bank" && bankAccountId) {
        data = await api.getBankTransactions(bankAccountId, startDate || undefined, endDate || undefined);
      }
      setTransactions(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error loading transactions:", error);
      setTransactions([]);
    } finally {
      setLoading(false);
    }
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
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      sale: "Sale",
      purchase_payment: "Purchase Payment",
      expense: "Expense",
      opening_balance: "Opening Balance",
      manual_add: "Manual Add",
    };
    return labels[source] || source;
  };

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const netAmount = totalIncome - totalExpense;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6 max-w-4xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
          Transaction History - {type === "cash" ? "Cash" : bankName || "Bank"}
        </h2>

        {/* Date Filters */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Income</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(totalIncome)}</p>
          </div>
          <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Expense</p>
            <p className="text-xl font-bold text-red-600">{formatCurrency(totalExpense)}</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Net Amount</p>
            <p className={`text-xl font-bold ${netAmount >= 0 ? "text-blue-600" : "text-red-600"}`}>
              {formatCurrency(netAmount)}
            </p>
          </div>
        </div>

        {/* Transactions List */}
        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No transactions found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className={`p-4 rounded-lg border ${
                  transaction.type === "income"
                    ? "bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800"
                    : "bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          transaction.type === "income"
                            ? "bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200"
                            : "bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200"
                        }`}
                      >
                        {transaction.type === "income" ? "Income" : "Expense"}
                      </span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {getSourceLabel(transaction.source)}
                      </span>
                    </div>
                    <p className="text-lg font-bold text-gray-800 dark:text-white">
                      {transaction.type === "income" ? "+" : "-"}
                      {formatCurrency(Number(transaction.amount))}
                    </p>
                    {transaction.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        {transaction.description}
                      </p>
                    )}
                    {transaction.bankAccount && (
                      <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                        Bank: {transaction.bankAccount.bankName} ({transaction.bankAccount.accountNumber})
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Added by: {transaction.userName} • {formatDate(transaction.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <Button onClick={onClose} size="sm">
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}


