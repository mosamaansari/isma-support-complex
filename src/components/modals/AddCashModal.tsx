import { useState, useEffect } from "react";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Select from "../form/Select";
import api from "../../services/api";
import { useAlert } from "../../context/AlertContext";
import { useData } from "../../context/DataContext";
import { getTodayDate } from "../../utils/dateHelpers";

interface AddCashModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  type?: "cash" | "bank";
  bankAccountId?: string;
  bankName?: string;
  date?: string; // Date for which to add balance
}

export default function AddCashModal({
  isOpen,
  onClose,
  onSuccess,
  type: initialType,
  bankAccountId: initialBankId,
  bankName: initialBankName,
  date: selectedDate,
}: AddCashModalProps) {
  const { showSuccess } = useAlert();
  const { currentUser, bankAccounts } = useData();
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState<"cash" | "bank">(initialType || "cash");
  const [selectedBankId, setSelectedBankId] = useState<string | undefined>(initialBankId);
  const [mode, setMode] = useState<"add" | "set">("add");
  const [currentRunningBalance, setCurrentRunningBalance] = useState<number>(0);

  // Field-specific errors
  const [errors, setErrors] = useState<{
    amount?: string;
    bankAccount?: string;
    type?: string;
    general?: string;
  }>({});

  // Reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedType(initialType || "cash");
      setSelectedBankId(initialBankId);
      setAmount(0);
      setDescription("");
      setErrors({});
      setMode("add");

      // Fetch current running balance to help user
      const dateStr = selectedDate || getTodayDate();
      api.getOpeningBalance(dateStr).then(balance => {
        if (balance) {
          if (initialType === "bank" && initialBankId) {
            const bank = (balance.bankBalances as any[])?.find((b: any) => b.bankAccountId === initialBankId);
            setCurrentRunningBalance(Number(bank?.balance) || 0);
          } else {
            setCurrentRunningBalance(Number(balance.cashBalance) || 0);
          }
        } else {
          setCurrentRunningBalance(0);
        }
      }).catch(() => setCurrentRunningBalance(0));
    }
  }, [isOpen, initialType, initialBankId, selectedDate]);

  const handleSubmit = async () => {
    // Clear previous errors
    setErrors({});

    // Client-side validation
    if (amount <= 0) {
      setErrors({ amount: "Amount must be greater than 0" });
      return;
    }

    if (selectedType === "bank" && !selectedBankId) {
      setErrors({ bankAccount: "Please select a bank account" });
      return;
    }

    if (!currentUser) {
      setErrors({ general: "User not logged in" });
      return;
    }

    setIsSubmitting(true);
    try {
      // Use selected date or today's date (ensure we use the correct date format)
      const dateStr = selectedDate || getTodayDate();
      let todayBalance = await api.getOpeningBalance(dateStr).catch(() => null);

      if (!todayBalance) {
        // Create new opening balance
        const createData = {
          date: dateStr,
          cashBalance: selectedType === "cash" ? amount : 0,
          bankBalances: selectedType === "bank" && selectedBankId
            ? [{ bankAccountId: selectedBankId, balance: amount }]
            : [],
          notes: description || undefined,
        };
        await api.createOpeningBalanceWithBanks(createData);
      } else {
        // Update existing opening balance
        const bankBalances = (todayBalance.bankBalances as any[]) || [];
        let updatedBankBalances = [...bankBalances];

        let newCash = Number(todayBalance.cashBalance) || 0;

        if (selectedType === "cash") {
          newCash = mode === "add" ? newCash + amount : amount;
        } else if (selectedType === "bank" && selectedBankId) {
          const existingBankIndex = updatedBankBalances.findIndex(
            (b: any) => b.bankAccountId === selectedBankId
          );

          if (existingBankIndex >= 0) {
            const currentBankBal = Number(updatedBankBalances[existingBankIndex].balance) || 0;
            updatedBankBalances[existingBankIndex].balance = mode === "add" ? currentBankBal + amount : amount;
          } else {
            updatedBankBalances.push({ bankAccountId: selectedBankId, balance: amount });
          }
        }

        const updateData: any = {
          notes: description || todayBalance.notes || undefined,
          cashBalance: selectedType === "cash" ? newCash : undefined,
          bankBalances: selectedType === "bank" ? updatedBankBalances : undefined,
        };

        await api.updateOpeningBalanceWithBanks(todayBalance.id, updateData);
      }

      showSuccess(`${selectedType === "cash" ? "Cash" : "Bank balance"} ${mode === "add" ? "added" : "set"} successfully!`);
      setAmount(0);
      setDescription("");
      setSelectedType("cash");
      setSelectedBankId(undefined);
      setErrors({});
      onSuccess();
      onClose();
    } catch (error: any) {
      // Parse validation errors from backend
      const errorData = error.response?.data;

      if (errorData?.error) {
        // Check if it's a validation error object
        if (typeof errorData.error === 'object') {
          const validationErrors: any = {};

          // Map backend validation errors to field errors
          if (errorData.error.bankBalances) {
            validationErrors.bankAccount = Array.isArray(errorData.error.bankBalances)
              ? errorData.error.bankBalances[0]
              : errorData.error.bankBalances;
          }
          if (errorData.error.cashBalance) {
            validationErrors.amount = Array.isArray(errorData.error.cashBalance)
              ? errorData.error.cashBalance[0]
              : errorData.error.cashBalance;
          }
          if (errorData.error.date) {
            validationErrors.general = Array.isArray(errorData.error.date)
              ? errorData.error.date[0]
              : errorData.error.date;
          }

          // If we have field-specific errors, use them
          if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
          } else {
            // Otherwise show general error
            setErrors({ general: errorData.message || "Validation failed" });
          }
        } else {
          // Simple error message
          setErrors({ general: errorData.error || errorData.message || "Failed to add balance" });
        }
      } else {
        setErrors({ general: "Failed to add balance. Please try again." });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedBank = bankAccounts.find((b) => b.id === selectedBankId);
  const isPreSelected = !!initialType; // If type is provided, it means it's pre-selected from a card
  const modalTitle = isPreSelected
    ? initialType === "cash"
      ? "Add Cash to Opening Balance"
      : `Add to ${initialBankName || "Bank"} Account`
    : "Add Opening Balance";

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md m-4">
      <div className="p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">
          {modalTitle}
        </h2>

        {/* General Error */}
        {errors.general && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-200">{errors.general}</p>
          </div>
        )}

        <div className="space-y-4">
          {/* Mode Selection */}
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <button
              onClick={() => {
                setMode("add");
                setAmount(0);
              }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${mode === "add"
                  ? "bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-400 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
            >
              Add Amount
            </button>
            <button
              onClick={() => {
                setMode("set");
                setAmount(currentRunningBalance);
              }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${mode === "set"
                  ? "bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-400 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
            >
              Set New Balance
            </button>
          </div>

          <div className="p-3 bg-brand-50 dark:bg-brand-900/10 rounded-lg border border-brand-100 dark:border-brand-900/20">
            <p className="text-xs text-brand-700 dark:text-brand-300">
              Current Running Balance: <span className="font-bold">Rs. {currentRunningBalance.toFixed(2)}</span>
            </p>
          </div>
          {/* Type Selection - Only show if not pre-selected */}
          {!isPreSelected && (
            <div>
              <Label>
                Add To <span className="text-error-500">*</span>
              </Label>
              <Select
                value={selectedType}
                onChange={(value) => {
                  setSelectedType(value as "cash" | "bank");
                  if (value === "cash") {
                    setSelectedBankId(undefined);
                  }
                  // Clear errors when type changes
                  setErrors(prev => ({ ...prev, bankAccount: undefined }));
                }}
                options={[
                  { value: "cash", label: "Cash" },
                  { value: "bank", label: "Bank Account" },
                ]}
              />
              {errors.type && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.type}</p>
              )}
            </div>
          )}

          {/* Show selected type if pre-selected */}
          {isPreSelected && (
            <div>
              <Label>Type</Label>
              <div className="h-11 w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white">
                {selectedType === "cash" ? "Cash" : `Bank: ${initialBankName || "Selected Bank"}`}
              </div>
            </div>
          )}

          {/* Bank Selection - Only show if bank is selected and not pre-selected */}
          {selectedType === "bank" && !isPreSelected && (
            <div>
              <Label>
                Select Bank <span className="text-error-500">*</span>
              </Label>
              <Select
                value={selectedBankId || ""}
                onChange={(value) => {
                  setSelectedBankId(value || undefined);
                  // Clear error when bank is selected
                  setErrors(prev => ({ ...prev, bankAccount: undefined }));
                }}
                placeholder="Select Bank Account"
                options={bankAccounts.map((bank) => ({
                  value: bank.id,
                  label: `${bank.bankName} - ${bank.accountNumber}`,
                }))}
              />
              {errors.bankAccount && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.bankAccount}</p>
              )}
            </div>
          )}

          {/* Show selected bank if pre-selected */}
          {selectedType === "bank" && isPreSelected && selectedBank && (
            <div>
              <Label>Bank Account</Label>
              <div className="h-11 w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white">
                {selectedBank.bankName} - {selectedBank.accountNumber}
              </div>
            </div>
          )}

          <div>
            <Label>
              {mode === "add" ? "Amount to Add" : "New Total Balance"} <span className="text-error-500">*</span>
            </Label>
            <Input
              type="number"
              step={0.01}
              value={amount || 0}
              onChange={(e) => {
                const value = e.target.value === "" ? 0 : parseFloat(e.target.value);
                setAmount(isNaN(value) ? 0 : value);
                // Clear error when amount changes
                setErrors(prev => ({ ...prev, amount: undefined }));
              }}
              placeholder="Enter amount"
              required
              className={errors.amount ? "border-red-500" : ""}
            />
            {errors.amount && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errors.amount}</p>
            )}
          </div>

          <div>
            <Label>Description (Optional)</Label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-300"
              placeholder="Add description (e.g., from where money came)"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || (mode === "add" && amount <= 0) || (selectedType === "bank" && !selectedBankId)}
              className="flex-1"
              size="sm"
            >
              {isSubmitting ? "Processing..." : mode === "add" ? "Add" : "Set Balance"}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
