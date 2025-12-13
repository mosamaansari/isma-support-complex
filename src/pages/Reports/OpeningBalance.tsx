import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import { DailyOpeningBalance, CardBalance } from "../../types";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Button from "../../components/ui/button/Button";
import { ChevronLeftIcon, PlusIcon, TrashBinIcon } from "../../icons";
import api from "../../services/api";

export default function OpeningBalance() {
  const { cards, refreshCards, currentUser } = useData();
  const navigate = useNavigate();
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [cashBalance, setCashBalance] = useState(0);
  const [cardBalances, setCardBalances] = useState<CardBalance[]>([]);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [existingBalance, setExistingBalance] = useState<DailyOpeningBalance | null>(null);

  useEffect(() => {
    refreshCards();
  }, [refreshCards]);

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
        setCardBalances(balance.cardBalances || []);
        setNotes(balance.notes || "");
      } else {
        setExistingBalance(null);
        setCashBalance(0);
        setCardBalances([]);
        setNotes("");
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        setExistingBalance(null);
        setCashBalance(0);
        setCardBalances([]);
        setNotes("");
      } else {
        console.error("Error loading opening balance:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  const addCardBalance = () => {
    if (cards.filter((c) => c.isActive).length === 0) {
      alert("No active cards available");
      return;
    }
    const availableCards = cards.filter(
      (c) => c.isActive && !cardBalances.some((cb) => cb.cardId === c.id)
    );
    if (availableCards.length === 0) {
      alert("All active cards have been added");
      return;
    }
    setCardBalances([
      ...cardBalances,
      { cardId: availableCards[0].id, balance: 0 },
    ]);
  };

  const removeCardBalance = (index: number) => {
    setCardBalances(cardBalances.filter((_, i) => i !== index));
  };

  const updateCardBalance = (index: number, field: "cardId" | "balance", value: any) => {
    setCardBalances(
      cardBalances.map((cb, i) => {
        if (i === index) {
          return { ...cb, [field]: field === "balance" ? parseFloat(value) || 0 : value };
        }
        return cb;
      })
    );
  };

  const handleSubmit = async () => {
    if (cashBalance < 0) {
      alert("Cash balance cannot be negative");
      return;
    }

    const invalidCard = cardBalances.find((cb) => cb.balance < 0);
    if (invalidCard) {
      alert("Card balance cannot be negative");
      return;
    }

    setIsSubmitting(true);
    try {
      const data = {
        date,
        cashBalance,
        cardBalances: cardBalances.filter((cb) => cb.cardId && cb.balance > 0),
        notes: notes || undefined,
      };

      if (existingBalance) {
        await api.updateOpeningBalance(existingBalance.id, data);
        alert("Opening balance updated successfully!");
      } else {
        await api.createOpeningBalance(data);
        alert("Opening balance created successfully!");
      }
      navigate("/reports");
    } catch (error: any) {
      alert(error.response?.data?.error || "Failed to save opening balance");
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
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label>
                  Cash Balance <span className="text-error-500">*</span>
                </Label>
                <Input
                  type="number"
                  step={0.01}
                  min="0"
                  value={cashBalance}
                  onChange={(e) => setCashBalance(parseFloat(e.target.value) || 0)}
                  placeholder="Enter cash balance"
                  required
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Card Balances</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addCardBalance}
                    disabled={cards.filter((c) => c.isActive).length === 0}
                  >
                    <PlusIcon className="w-4 h-4 mr-2" />
                    Add Card
                  </Button>
                </div>

                {cardBalances.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No card balances added. Click "Add Card" to add one.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {cardBalances.map((cardBalance, index) => {
                      const availableCards = cards.filter(
                        (c) =>
                          c.isActive &&
                          (c.id === cardBalance.cardId ||
                            !cardBalances.some((cb) => cb.cardId === c.id && cb !== cardBalance))
                      );
                      return (
                        <div
                          key={index}
                          className="p-3 border border-gray-200 rounded-lg dark:border-gray-700 flex items-center gap-3"
                        >
                          <div className="flex-1">
                            <select
                              value={cardBalance.cardId}
                              onChange={(e) =>
                                updateCardBalance(index, "cardId", e.target.value)
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                            >
                              <option value="">Select a card</option>
                              {availableCards.map((card) => (
                                <option key={card.id} value={card.id}>
                                  {card.name}
                                  {card.isDefault ? " (Default)" : ""}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex-1">
                            <Input
                              type="number"
                              step={0.01}
                              min="0"
                              value={cardBalance.balance}
                              onChange={(e) =>
                                updateCardBalance(index, "balance", e.target.value)
                              }
                              placeholder="Balance"
                            />
                          </div>
                          <button
                            onClick={() => removeCardBalance(index)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded dark:hover:bg-red-900/20"
                          >
                            <TrashBinIcon className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
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
                  disabled={isSubmitting || cashBalance < 0}
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

