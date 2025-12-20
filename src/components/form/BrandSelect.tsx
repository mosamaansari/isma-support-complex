import { useState, useEffect } from "react";
import { useData } from "../../context/DataContext";
import { useAlert } from "../../context/AlertContext";
import Select from "./Select";
import Button from "../ui/button/Button";
import Input from "./input/InputField";
import Label from "./Label";

interface BrandSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
}

export default function BrandSelect({
  value,
  onChange,
  className = "",
  required = false,
}: BrandSelectProps) {
  const { brands, addBrand, refreshBrands } = useData();
  const { showSuccess, showError } = useAlert();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandDesc, setNewBrandDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (brands.length === 0) {
      refreshBrands().catch(console.error);
    }
  }, [brands.length, refreshBrands]);

  const handleAddBrand = async () => {
    if (!newBrandName.trim()) {
      showError("Please enter a brand name");
      return;
    }

    setIsSubmitting(true);
    try {
      await addBrand({
        name: newBrandName.trim(),
        description: newBrandDesc.trim() || undefined,
      });
      await refreshBrands();
      // Select the newly created brand
      onChange(newBrandName.trim());
      setNewBrandName("");
      setNewBrandDesc("");
      setShowAddModal(false);
      showSuccess("Brand created successfully!");
    } catch (err: any) {
      showError(err.response?.data?.error || "Failed to create brand");
      console.error("Error creating brand:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const brandOptions = brands.map((brand) => ({
    value: brand.name,
    label: brand.name,
  }));

  // Add "Add New Brand" option
  brandOptions.push({
    value: "__add_new__",
    label: "+ Add New Brand",
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
          options={brandOptions}
          placeholder="Select brand"
          className={className}
        />
      </div>

      {/* Add Brand Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 py-8">
          <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-lg dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
            <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white">
              Add New Brand
            </h3>

            <div className="space-y-4">
              <div>
                <Label>
                  Brand Name <span className="text-error-500">*</span>
                </Label>
                <Input
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  placeholder="Enter brand name"
                  required
                />
              </div>

              <div>
                <Label>Description (Optional)</Label>
                <Input
                  value={newBrandDesc}
                  onChange={(e) => setNewBrandDesc(e.target.value)}
                  placeholder="Enter brand description"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                type="button"
                size="sm"
                onClick={handleAddBrand}
                disabled={isSubmitting || !newBrandName.trim()}
              >
                {isSubmitting ? "Adding..." : "Add Brand"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddModal(false);
                  setNewBrandName("");
                  setNewBrandDesc("");
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


