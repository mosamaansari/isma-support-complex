import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import { ExpenseCategory, PaymentType } from "../../types";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Select from "../../components/form/Select";
import Button from "../../components/ui/button/Button";
import { ChevronLeftIcon } from "../../icons";

export default function ExpenseForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { expenses, addExpense, updateExpense, currentUser, cards, refreshCards, bankAccounts, refreshBankAccounts } = useData();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    amount: "",
    category: "other" as ExpenseCategory,
    description: "",
    paymentType: "cash" as PaymentType,
    cardId: "",
    bankAccountId: "",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (cards.length === 0) {
      refreshCards();
    }
    if (bankAccounts.length === 0) {
      refreshBankAccounts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isEdit && id) {
      const expense = expenses.find((e) => e.id === id);
      if (expense) {
        setFormData({
          amount: expense.amount.toString(),
          category: expense.category,
          description: expense.description,
          paymentType: expense.paymentType || "cash",
          cardId: (expense as any).cardId || "",
          bankAccountId: (expense as any).bankAccountId || "",
          date: expense.date,
        });
      }
    }
  }, [isEdit, id, expenses]);

  // Auto-select default card when payment type changes to card
  useEffect(() => {
    if (formData.paymentType === "card" && !formData.cardId && cards.length > 0) {
      const defaultCard = cards.find((c) => c.isDefault && c.isActive) || cards[0];
      if (defaultCard) {
        setFormData((prev) => ({ ...prev, cardId: defaultCard.id }));
      }
    } else if (formData.paymentType !== "card") {
      setFormData((prev) => ({ ...prev, cardId: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.paymentType, cards.length]);

  // Auto-select default bank account when payment type changes to bank_transfer
  useEffect(() => {
    if (formData.paymentType === "bank_transfer" && !formData.bankAccountId && bankAccounts.length > 0) {
      const defaultAccount = bankAccounts.find((acc) => acc.isDefault && acc.isActive) || bankAccounts[0];
      if (defaultAccount) {
        setFormData((prev) => ({ ...prev, bankAccountId: defaultAccount.id }));
      }
    } else if (formData.paymentType !== "bank_transfer") {
      setFormData((prev) => ({ ...prev, bankAccountId: "" }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.paymentType, bankAccounts.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.paymentType === "card" && !formData.cardId) {
      alert("Please select a card for card payment");
      return;
    }

    if (formData.paymentType === "bank_transfer" && !formData.bankAccountId) {
      alert("Please select a bank account for bank transfer");
      return;
    }

    const expenseData = {
      amount: parseFloat(formData.amount),
      category: formData.category,
      description: formData.description,
      paymentType: formData.paymentType,
      cardId: formData.cardId || undefined,
      bankAccountId: formData.bankAccountId || undefined,
      date: formData.date,
      userId: currentUser!.id,
      userName: currentUser!.name,
    };

    if (isEdit && id) {
      updateExpense(id, expenseData);
    } else {
      addExpense(expenseData);
    }

    navigate("/expenses");
  };

  return (
    <>
      <PageMeta
        title={`${isEdit ? "Edit" : "Add"} Expense | Isma Sports Complex`}
        description={`${isEdit ? "Edit" : "Add"} expense entry`}
      />
      <div className="mb-6">
        <Link to="/expenses">
          <Button variant="outline" size="sm">
            <ChevronLeftIcon className="w-4 h-4 mr-2" />
            Back to Expenses
          </Button>
        </Link>
      </div>

      <div className="max-w-2xl p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
        <h1 className="mb-6 text-2xl font-bold text-gray-800 dark:text-white">
          {isEdit ? "Edit Expense" : "Add New Expense"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label>
              Amount <span className="text-error-500">*</span>
            </Label>
            <Input
              type="number"
              step={0.01}
              min="0"
              value={String(formData.amount)}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <Label>
              Category <span className="text-error-500">*</span>
            </Label>
            <Select
              value={formData.category}
              onChange={(value) =>
                setFormData({
                  ...formData,
                  category: value as ExpenseCategory,
                })
              }
              options={[
                { value: "rent", label: "Rent" },
                { value: "bills", label: "Bills" },
                { value: "transport", label: "Transport" },
                { value: "salaries", label: "Salaries" },
                { value: "maintenance", label: "Maintenance" },
                { value: "marketing", label: "Marketing" },
                { value: "other", label: "Other" },
              ]}
            />
          </div>

          <div>
            <Label>
              Description <span className="text-error-500">*</span>
            </Label>
            <Input
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Enter expense description"
              required
            />
          </div>

          <div>
            <Label>
              Date <span className="text-error-500">*</span>
            </Label>
            <Input
              type="date"
              value={formData.date}
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
              required
            />
          </div>

          <div>
            <Label>
              Payment Type <span className="text-error-500">*</span>
            </Label>
            <Select
              value={formData.paymentType}
              onChange={(value) =>
                setFormData({ ...formData, paymentType: value as PaymentType })
              }
              options={[
                { value: "cash", label: "Cash" },
                { value: "card", label: "Card" },
                { value: "bank_transfer", label: "Bank Transfer" },
              ]}
            />
          </div>

          {formData.paymentType === "card" && (
            <div>
              <Label>
                Select Card <span className="text-error-500">*</span>
              </Label>
              {cards.filter((c) => c.isActive).length === 0 ? (
                <div className="p-2 text-sm text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded">
                  No active cards available. Please add a card in Settings.
                </div>
              ) : (
                <>
                  <Select
                    value={formData.cardId}
                    onChange={(value) =>
                      setFormData({ ...formData, cardId: value })
                    }
                    options={[
                      { value: "", label: "Select a card" },
                      ...cards
                        .filter((c) => c.isActive)
                        .map((card) => ({
                          value: card.id,
                          label: `${card.name}${card.isDefault ? " (Default)" : ""}${card.cardNumber ? ` - ****${card.cardNumber.slice(-4)}` : ""}`,
                        })),
                    ]}
                  />
                  {!formData.cardId && (
                    <p className="mt-1 text-xs text-error-500">
                      Please select a card for this payment
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {formData.paymentType === "bank_transfer" && (
            <div>
              <Label>
                Select Bank Account <span className="text-error-500">*</span>
              </Label>
              {bankAccounts.filter((b) => b.isActive).length === 0 ? (
                <div className="p-2 text-sm text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 rounded">
                  No active bank accounts available. Please add a bank account in Settings.
                </div>
              ) : (
                <>
                  <Select
                    value={formData.bankAccountId}
                    onChange={(value) =>
                      setFormData({ ...formData, bankAccountId: value })
                    }
                    options={[
                      { value: "", label: "Select a bank account" },
                      ...bankAccounts
                        .filter((b) => b.isActive)
                        .map((account) => ({
                          value: account.id,
                          label: `${account.accountName}${account.isDefault ? " (Default)" : ""} - ${account.bankName}`,
                        })),
                    ]}
                  />
                  {!formData.bankAccountId && (
                    <p className="mt-1 text-xs text-error-500">
                      Please select a bank account for this payment
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          <div className="flex gap-4">
            <Button type="submit" size="sm">
              {isEdit ? "Update Expense" : "Add Expense"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/expenses")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

