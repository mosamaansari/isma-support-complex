import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useAlert } from "../../context/AlertContext";
import { DailyOpeningBalance } from "../../types";
import Input from "../../components/form/input/InputField";
import DatePicker from "../../components/form/DatePicker";
import Label from "../../components/form/Label";
import Button from "../../components/ui/button/Button";
import { ChevronLeftIcon } from "../../icons";
import api from "../../services/api";
import { getTodayDate } from "../../utils/dateHelpers";

export default function OpeningBalance() {
  const { showSuccess, showError } = useAlert();
  const navigate = useNavigate();
  const [date, setDate] = useState(getTodayDate());
  const [cashBalance, setCashBalance] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingBalance, setExistingBalance] = useState<DailyOpeningBalance | null>(null);

  useEffect(() => {
    loadOpeningBalance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const loadOpeningBalance = async () => {
    setLoading(true);
    try {
      const balance = await api.getOpeningBalance(date);
      if (balance) {
        setExistingBalance(balance);
        setCashBalance(Number(balance.cashBalance));
        setNotes(balance.notes || "");
      } else {
        setExistingBalance(null);
        setCashBalance(null);
        setNotes("");
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        setExistingBalance(null);
        setCashBalance(null);
        setNotes("");
      } else {
        console.error("Error loading opening balance:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!cashBalance || cashBalance < 1) {
      showError("Cash balance must be at least 1");
      return;
    }

    setIsSubmitting(true);
    try {
      if (existingBalance) {
        // For update, don't send date - it cannot be changed
        const updateData = {
          cashBalance,
          cardBalances: [],
          notes: notes || undefined,
        };
        await api.updateOpeningBalance(existingBalance.id, updateData);
        showSuccess("Opening balance updated successfully!");
      } else {
        // For create, include date
        const createData = {
          date,
          cashBalance,
          cardBalances: [],
          notes: notes || undefined,
        };
        await api.createOpeningBalance(createData);
        showSuccess("Opening balance created successfully!");
      }
      navigate("/reports");
    } catch (error: any) {
      showError(error.response?.data?.error || "Failed to save opening balance");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <PageMeta
        title="Daily Opening Balance | Isma Sports Complex"
        description="Enter daily opening balance"
      />
      <div className="mb-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/reports")}>
          <ChevronLeftIcon className="w-4 h-4 mr-2" />
          Back to Reports
        </Button>
      </div>

      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm dark:bg-gray-800 p-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">
            Daily Opening Balance
          </h1>

          {loading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <Label>
                  Date <span className="text-error-500">*</span>
                </Label>
                <DatePicker
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  disabled={!!existingBalance}
                />
                {existingBalance && (
                  <p className="text-gray-500 text-sm mt-1">
                    Date cannot be changed for existing opening balance
                  </p>
                )}
              </div>

              <div>
                <Label>
                  Cash Balance <span className="text-error-500">*</span>
                </Label>
                <Input
                  type="number"
                  step={0.01}
                  min="1"
                  value={cashBalance ?? ""}
                  onChange={(e) => {
                    const value = e.target.value === "" ? null : parseFloat(e.target.value);
                    setCashBalance(value);
                  }}
                  placeholder="Enter cash balance (minimum 1)"
                  required
                />
                {(!cashBalance || cashBalance < 1) && (
                  <p className="text-error-500 text-sm mt-1">
                    Cash balance must be at least 1
                  </p>
                )}
              </div>

              <div>
                <Label>Notes (Optional)</Label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                  placeholder="Add any notes..."
                />
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  onClick={handleSubmit}
                  size="sm"
                  className="flex-1"
                  disabled={isSubmitting || !cashBalance || cashBalance < 1}
                >
                  {isSubmitting
                    ? existingBalance
                      ? "Updating..."
                      : "Saving..."
                    : existingBalance
                    ? "Update Opening Balance"
                    : "Save Opening Balance"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/reports")}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

