import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import { useAlert } from "../../context/AlertContext";
import { ExpenseCategory, PaymentType } from "../../types";
import Input from "../../components/form/input/InputField";
import DatePicker from "../../components/form/DatePicker";
import Label from "../../components/form/Label";
import Select from "../../components/form/Select";
import Button from "../../components/ui/button/Button";
import { ChevronLeftIcon } from "../../icons";
import { getTodayDate } from "../../utils/dateHelpers";
import { restrictDecimalInput } from "../../utils/numberHelpers";

const expenseFormSchema = yup.object().shape({
  amount: yup
    .number()
    .required("Amount is required")
    .min(0.01, "Amount must be greater than 0")
    .max(100000000, "Amount is too large"),
  category: yup
    .string()
    .required("Category is required")
    .oneOf(["rent", "bills", "transport", "salaries", "maintenance", "marketing", "tea", "breakfast", "lunch", "dinner", "refreshment", "other"], "Invalid category"),
  description: yup
    .string()
    .optional()
    .max(500, "Description must be less than 500 characters"),
  paymentType: yup
    .string()
    .required("Payment type is required")
    .oneOf(["cash", "bank_transfer"], "Invalid payment type"),
  cardId: yup
    .string()
    .optional()
    .when("paymentType", {
      is: "card",
      then: (schema) => schema.required("Please select a card for card payment"),
    }),
  bankAccountId: yup
    .string()
    .optional()
    .when("paymentType", {
      is: "bank_transfer",
      then: (schema) => schema.required("Please select a bank account for bank transfer"),
    }),
  date: yup
    .string()
    .required("Date is required")
    .test("not-empty", "Date is required", (value) => !!value && value.trim() !== ""),
});

export default function ExpenseForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { expenses, addExpense, updateExpense, currentUser, cards, refreshCards, bankAccounts, refreshBankAccounts, refreshExpenses } = useData();
  const { showSuccess, showError } = useAlert();
  const isEdit = !!id;
  const [backendErrors, setBackendErrors] = useState<Record<string, string>>({});

  const {
    register,
    handleSubmit: handleFormSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm({
    resolver: yupResolver(expenseFormSchema),
    defaultValues: {
      amount: undefined,
      category: "other" as ExpenseCategory,
      description: "",
      paymentType: "cash" as PaymentType,
      cardId: "",
      bankAccountId: "",
      date: isEdit ? "" : getTodayDate(),
    },
  });

  const formData = {
    amount: watch("amount"),
    category: watch("category") as ExpenseCategory,
    description: watch("description"),
    paymentType: watch("paymentType") as PaymentType,
    cardId: watch("cardId"),
    bankAccountId: watch("bankAccountId"),
    date: watch("date"),
  };

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
        // Convert date from ISO string to YYYY-MM-DD format for DatePicker
        let dateValue = "";
        if (expense.date) {
          try {
            const date = new Date(expense.date);
            if (!isNaN(date.getTime())) {
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, "0");
              const day = String(date.getDate()).padStart(2, "0");
              dateValue = `${year}-${month}-${day}`;
            }
          } catch (e) {
            // If date is already in YYYY-MM-DD format, use it directly
            if (typeof expense.date === 'string' && expense.date.match(/^\d{4}-\d{2}-\d{2}/)) {
              dateValue = expense.date.split('T')[0]; // Extract YYYY-MM-DD part if it's ISO string
            }
          }
        }
        
        reset({
          amount: expense.amount,
          category: expense.category,
          description: expense.description || "",
          paymentType: expense.paymentType || "cash",
          cardId: (expense as any).cardId || "",
          bankAccountId: (expense as any).bankAccountId || "",
          date: dateValue,
        });
      }
    }
  }, [isEdit, id, expenses, reset]);


  // Auto-select default bank account when payment type changes to bank_transfer
  useEffect(() => {
    if (formData.paymentType === "bank_transfer" && !formData.bankAccountId && bankAccounts.length > 0) {
      const defaultAccount = bankAccounts.find((acc) => acc.isDefault && acc.isActive) || bankAccounts[0];
      if (defaultAccount) {
        setValue("bankAccountId", defaultAccount.id);
      }
    } else if (formData.paymentType !== "bank_transfer") {
      setValue("bankAccountId", "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.paymentType, bankAccounts.length]);

  const onSubmit = async (data: any) => {
    const expenseData: any = {
      amount: typeof data.amount === "number" ? data.amount : parseFloat(data.amount) || 0,
      category: data.category,
      description: data.description && data.description.trim() ? data.description.trim() : undefined,
      paymentType: data.paymentType,
      date: data.date,
      userId: currentUser!.id,
      userName: currentUser!.name,
    };

    // Only include cardId if payment type is card
    if (data.paymentType === "card" && data.cardId) {
      expenseData.cardId = data.cardId;
    }

    // Only include bankAccountId if payment type is bank_transfer
    if (data.paymentType === "bank_transfer" && data.bankAccountId) {
      expenseData.bankAccountId = data.bankAccountId;
    }

    try {
      // Clear previous backend errors
      setBackendErrors({});
      
      if (isEdit && id) {
        await updateExpense(id, expenseData);
        showSuccess("Expense updated successfully!");
      } else {
        await addExpense(expenseData);
        showSuccess("Expense added successfully!");
      }
      // Refresh expenses list before navigating
      await refreshExpenses(1, 10);
      navigate("/expenses");
    } catch (err: any) {
      // Handle backend validation errors
      if (err.response?.data?.error && typeof err.response.data.error === 'object') {
        const validationErrors: Record<string, string> = {};
        Object.keys(err.response.data.error).forEach((field) => {
          const fieldErrors = err.response.data.error[field];
          if (Array.isArray(fieldErrors) && fieldErrors.length > 0) {
            validationErrors[field] = fieldErrors[0]; // Take first error message
          }
        });
        setBackendErrors(validationErrors);
        
        // Set errors in react-hook-form
        Object.keys(validationErrors).forEach((field) => {
          setValue(field as any, formData[field as keyof typeof formData], { shouldValidate: false });
        });
        
        // Show generic error message
        showError("Please fix the validation errors below");
      } else {
        const errorMessage = err.response?.data?.error || err.response?.data?.message || "Failed to save expense. Please try again.";
        showError(errorMessage);
      }
      console.error("Error saving expense:", err);
    }
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

        <form onSubmit={handleFormSubmit(onSubmit)} className="space-y-6">
          <div>
            <Label>
              Amount <span className="text-error-500">*</span>
            </Label>
            <Input
              type="number"
              name="amount"
              step={0.01}
              min="0"
              value={formData.amount ?? ""}
              onInput={restrictDecimalInput}
              onChange={(e) => {
                if (e.target.value === "") {
                  setValue("amount", undefined as any);
                } else {
                  const value = parseFloat(e.target.value);
                  setValue("amount", isNaN(value) ? (undefined as any) : value);
                }
              }}
              onBlur={register("amount").onBlur}
              placeholder="0.00"
              required
              error={!!errors.amount || !!backendErrors.amount}
              hint={errors.amount?.message || backendErrors.amount}
            />
          </div>

          <div>
            <Label>
              Category <span className="text-error-500">*</span>
            </Label>
            <Select
              value={formData.category}
              onChange={(value) => {
                setValue("category", value);
              }}
              options={[
                { value: "rent", label: "Rent" },
                { value: "bills", label: "Bills" },
                { value: "transport", label: "Transport" },
                { value: "salaries", label: "Salaries" },
                { value: "maintenance", label: "Maintenance" },
                { value: "marketing", label: "Marketing" },
                { value: "tea", label: "Tea" },
                { value: "breakfast", label: "Breakfast" },
                { value: "lunch", label: "Lunch" },
                { value: "dinner", label: "Dinner" },
                { value: "refreshment", label: "Refreshment" },
                { value: "other", label: "Other" },
              ]}
            />
            {errors.category && (
              <p className="mt-1.5 text-xs text-error-500">{errors.category.message}</p>
            )}
          </div>

          <div>
            <Label>Description</Label>
            <Input
              name="description"
              value={formData.description}
              onChange={(e) => {
                setValue("description", e.target.value);
              }}
              onBlur={register("description").onBlur}
              placeholder="Enter description (optional)"
              error={!!errors.description || !!backendErrors.description}
              hint={errors.description?.message || backendErrors.description}
            />
          </div>

          <div>
            <Label>
              Payment Type <span className="text-error-500">*</span>
            </Label>
            <Select
              value={formData.paymentType}
              onChange={(value) => {
                setValue("paymentType", value);
              }}
              options={[
                { value: "cash", label: "Cash" },
                { value: "bank_transfer", label: "Bank Transfer" },
              ]}
            />
            {(errors.paymentType || backendErrors.paymentType) && (
              <p className="mt-1.5 text-xs text-error-500">{errors.paymentType?.message || backendErrors.paymentType}</p>
            )}
          </div>

          {formData.paymentType === "bank_transfer" && (
            <div>
              <Label>
                Select Bank Account <span className="text-error-500">*</span>
              </Label>
              <Select
                value={formData.bankAccountId}
                onChange={(value) => {
                  setValue("bankAccountId", value);
                }}
                options={[
                  ...bankAccounts
                    .filter((acc) => acc.isActive)
                    .map((acc) => ({
                      value: acc.id,
                      label: `${acc.accountName} - ${acc.bankName}${acc.isDefault ? " (Default)" : ""}`,
                    })),
                ]}
              />
              {(errors.bankAccountId || backendErrors.bankAccountId) && (
                <p className="mt-1.5 text-xs text-error-500">{errors.bankAccountId?.message || backendErrors.bankAccountId}</p>
              )}
            </div>
          )}

          <div>
            <Label>
              Date <span className="text-error-500">*</span>
            </Label>
            <DatePicker
              name="date"
              value={formData.date}
              onChange={(e) => {
                setValue("date", e.target.value);
              }}
              onBlur={register("date").onBlur}
              required
              error={!!errors.date || !!backendErrors.date}
              hint={errors.date?.message || backendErrors.date}
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
