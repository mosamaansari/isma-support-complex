import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import api from "../../services/api";
import { useAlert } from "../../context/AlertContext";
import { useData } from "../../context/DataContext";
import { setCookie } from "../../utils/cookies";

interface DailyConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  previousCashBalance: number;
  bankBalances: Array<{
    bankAccountId: string;
    bankName: string;
    accountNumber: string;
    balance: number;
  }>;
}

export default function DailyConfirmationModal({
  isOpen,
  onConfirm,
  previousCashBalance,
  bankBalances,
}: DailyConfirmationModalProps) {
  const navigate = useNavigate();
  const { showError } = useAlert();
  const { refreshBankAccounts, bankAccounts } = useData();
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (isOpen && bankAccounts.length === 0) {
      refreshBankAccounts();
    }
  }, [isOpen, bankAccounts.length, refreshBankAccounts]);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await api.confirmDaily();
      // Store today's date in cookie after successful confirmation
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const today = `${year}-${month}-${day}`;
      setCookie("daily_confirmation_date", today, 1);
      onConfirm();
    } catch (error: any) {
      showError(error.response?.data?.error || "Failed to confirm. Please try again.");
    } finally {
      setIsConfirming(false);
    }
  };

  const handleAddOpeningBalance = async () => {
    // Store confirmation before navigating
    setIsConfirming(true);
    try {
      await api.confirmDaily();
      // Store today's date in cookie after successful confirmation
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const today = `${year}-${month}-${day}`;
      setCookie("daily_confirmation_date", today, 1);
      onConfirm();
      navigate("/reports/opening-balance");
    } catch (error: any) {
      showError(error.response?.data?.error || "Failed to confirm. Please try again.");
      setIsConfirming(false);
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

  return (
    <Modal isOpen={isOpen} onClose={() => {}} showCloseButton={false}>
      <div className="p-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
          Daily Opening Balance Confirmation
        </h2>
        
        <div className="mb-6">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {previousCashBalance === 0 && bankBalances.length === 0
              ? "This appears to be your first time setup. Please confirm to proceed or add opening balance."
              : "Please confirm the previous day's closing balances before proceeding."}
          </p>

          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
            <h3 className="font-semibold text-gray-800 dark:text-white mb-2">
              {previousCashBalance === 0 && bankBalances.length === 0
                ? "Current Cash Balance"
                : "Previous Cash Balance"}
            </h3>
            <p className="text-2xl font-bold text-brand-600">
              {formatCurrency(previousCashBalance)}
            </p>
          </div>

          {bankBalances.length > 0 && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-gray-800 dark:text-white mb-3">
                Bank-wise Balances
              </h3>
              <div className="space-y-2">
                {bankBalances.map((bank) => (
                  <div
                    key={bank.bankAccountId}
                    className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-gray-800 dark:text-white">
                        {bank.bankName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {bank.accountNumber}
                      </p>
                    </div>
                    <p className="text-lg font-semibold text-brand-600">
                      {formatCurrency(bank.balance)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bankBalances.length === 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                {previousCashBalance === 0 && bankBalances.length === 0
                  ? "No previous bank balances found. You can add bank accounts and opening balances after confirming."
                  : "No bank accounts found. Please add bank accounts in settings."}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleConfirm}
            disabled={isConfirming}
            className="flex-1"
            size="sm"
          >
            {isConfirming ? "Confirming..." : "OK"}
          </Button>
          <Button
            variant="outline"
            onClick={handleAddOpeningBalance}
            disabled={isConfirming}
            className="flex-1"
            size="sm"
          >
            {isConfirming ? "Confirming..." : "Add Opening Balance / More in Account"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

