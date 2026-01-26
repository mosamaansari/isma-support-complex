import { useState, useEffect } from "react";
import { useData } from "../../context/DataContext";
import { useAlert } from "../../context/AlertContext";
import Select from "./Select";
import Button from "../ui/button/Button";
import Input from "./input/InputField";
import Label from "./Label";

interface ExpenseCategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
}

export default function ExpenseCategorySelect({
  value,
  onChange,
  className = "",
}: ExpenseCategorySelectProps) {
  const { expenseCategories, addExpenseCategory, refreshExpenseCategories } = useData();
  const { showSuccess, showError } = useAlert();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (expenseCategories.length === 0) {
      refreshExpenseCategories().catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenseCategories.length]); // Only depend on expenseCategories.length, not refreshExpenseCategories

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      showError("Please enter an expense category name");
      return;
    }

    setIsSubmitting(true);
    try {
      await addExpenseCategory({
        name: newCategoryName.trim(),
        description: newCategoryDesc.trim() || undefined,
      });
      await refreshExpenseCategories();
      // Select the newly created category
      onChange(newCategoryName.trim());
      setNewCategoryName("");
      setNewCategoryDesc("");
      setShowAddModal(false);
      showSuccess("Expense category created successfully!");
    } catch (err: any) {
      showError(err.response?.data?.error || "Failed to create expense category");
      console.error("Error creating expense category:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryOptions = expenseCategories.map((cat) => ({
    value: cat.name,
    label: cat.name,
  }));

  // Add "Add New Category" option
  categoryOptions.push({
    value: "__add_new__",
    label: "+ Add New Category",
  });

  const handleSelectChange = (selectedValue: string) => {
    if (selectedValue === "__add_new__") {
      setShowAddModal(true);
    } else {
      onChange(selectedValue);
    }
  };

  return (
    <>
      <div className="relative">
        <Select
          value={value}
          onChange={handleSelectChange}
          options={categoryOptions}
          placeholder="Select  category"
          className={className}
        />
      </div>

      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 py-8">
          <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-lg dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
            <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white">
              Add New Category
            </h3>

            <div className="space-y-4">
              <div>
                <Label>
                  Category Name <span className="text-error-500">*</span>
                </Label>
                <Input
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Enter category name"
                  required
                />
              </div>

              <div>
                <Label>Description (Optional)</Label>
                <Input
                  value={newCategoryDesc}
                  onChange={(e) => setNewCategoryDesc(e.target.value)}
                  placeholder="Enter description"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                type="button"
                size="sm"
                onClick={handleAddCategory}
                loading={isSubmitting}
                disabled={isSubmitting || !newCategoryName.trim()}
              >
                Add Category
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddModal(false);
                  setNewCategoryName("");
                  setNewCategoryDesc("");
                }}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

