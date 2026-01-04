import { useState, useEffect } from "react";
import { useData } from "../../context/DataContext";
import { useAlert } from "../../context/AlertContext";
import Select from "./Select";
import Button from "../ui/button/Button";
import Input from "./input/InputField";
import Label from "./Label";

interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
}

export default function CategorySelect({
  value,
  onChange,
  className = "",
}: CategorySelectProps) {
  const { categories, addCategory, refreshCategories } = useData();
  const { showSuccess, showError } = useAlert();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDesc, setNewCategoryDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (categories.length === 0) {
      refreshCategories().catch(console.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories.length]); // Only depend on categories.length, not refreshCategories

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      showError("Please enter a category name");
      return;
    }

    setIsSubmitting(true);
    try {
      await addCategory({
        name: newCategoryName.trim(),
        description: newCategoryDesc.trim() || undefined,
      });
      await refreshCategories();
      // Select the newly created category
      onChange(newCategoryName.trim());
      setNewCategoryName("");
      setNewCategoryDesc("");
      setShowAddModal(false);
      showSuccess("Category created successfully!");
    } catch (err: any) {
      showError(err.response?.data?.error || "Failed to create category");
      console.error("Error creating category:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoryOptions = categories.map((cat) => ({
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
          placeholder="Select category"
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
                  placeholder="Enter category description"
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

