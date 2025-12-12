import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import { ExpenseCategory } from "../../types";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Select from "../../components/form/Select";
import Button from "../../components/ui/button/Button";
import { ChevronLeftIcon } from "../../icons";

export default function ExpenseForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { expenses, addExpense, updateExpense, currentUser } = useData();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    amount: "",
    category: "other" as ExpenseCategory,
    description: "",
    date: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (isEdit && id) {
      const expense = expenses.find((e) => e.id === id);
      if (expense) {
        setFormData({
          amount: expense.amount,
          category: expense.category,
          description: expense.description,
          date: expense.date,
        });
      }
    }
  }, [isEdit, id, expenses]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const expenseData = {
      amount: parseFloat(formData.amount),
      category: formData.category,
      description: formData.description,
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
              step="0.01"
              min="0"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
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

