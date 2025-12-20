import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
// import { useData } from "../../context/DataContext";
import { useAlert } from "../../context/AlertContext";
import Select from "./Select";
import Button from "../ui/button/Button";
import Input from "./input/InputField";
import Label from "./Label";
import { UserRole } from "../../types";
import api from "../../services/api";

const roleFormSchema = yup.object().shape({
  name: yup
    .string()
    .required("Role name is required")
    .min(1, "Role name must be at least 1 character")
    .max(50, "Role name cannot exceed 50 characters")
    .matches(/^[a-z][a-z0-9_]*$/, "Role name must be lowercase, start with a letter, and can contain underscores"),
  label: yup
    .string()
    .required("Role label is required")
    .min(1, "Role label must be at least 1 character")
    .max(255, "Role label cannot exceed 255 characters"),
  description: yup
    .string()
    .optional()
    .max(500, "Description cannot exceed 500 characters"),
});

interface RoleSelectProps {
  value: UserRole;
  onChange: (value: UserRole) => void;
  className?: string;
  required?: boolean;
  currentUserRole?: UserRole;
}

export default function RoleSelect({
  value,
  onChange,
  className = "",
  currentUserRole,
}: RoleSelectProps) {
  const { showSuccess, showError } = useAlert();
  const [roles, setRoles] = useState<Array<{ name: string; label: string; description?: string; isCustom?: boolean }>>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Form handling with react-hook-form
  const {
    register,
    handleSubmit: handleFormSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
    setError,
    clearErrors,
  } = useForm({
    resolver: yupResolver(roleFormSchema),
    defaultValues: {
      name: "",
      label: "",
      description: "",
    },
  });

  const formData = {
    name: watch("name"),
    label: watch("label"),
    description: watch("description"),
  };

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setIsLoading(true);
      const data = await api.getRoles();
      // Handle both array response and wrapped response
      const rolesList = Array.isArray(data) ? data : (data?.data || data || []);
      setRoles(rolesList);
    } catch (err) {
      console.error("Error loading roles:", err);
      // Fallback to default roles
      setRoles([
        { name: "superadmin", label: "Super Admin", description: "Full system access" },
        { name: "admin", label: "Admin", description: "Administrative access" },
        { name: "cashier", label: "Cashier", description: "Sales and billing access" },
        { name: "warehouse_manager", label: "Warehouse Manager", description: "Inventory management access" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRole = async (data: any) => {
    setIsSubmitting(true);
    setFormErrors({});
    clearErrors();
    
    try {
      console.log("Creating role with data:", data);
      
      // Create role via API
      const response = await api.createRole({
        name: data.name.trim().toLowerCase(),
        label: data.label.trim(),
        description: data.description?.trim() || undefined,
      });
      
      console.log("Role creation response:", response);
      
      // Extract role from response - handle different response formats
      let newRole = null;
      if (response?.data) {
        newRole = response.data;
      } else if (response?.name) {
        newRole = response;
      } else if (response) {
        newRole = response;
      }
      
      if (!newRole || !newRole.name) {
        console.error("Invalid role response:", response);
        throw new Error("Invalid response from server. Role was not created.");
      }
      
      // Reload roles to get updated list
      await loadRoles();
      
      // Select the newly created role
      onChange(newRole.name as UserRole);
      
      // Reset form
      reset({
        name: "",
        label: "",
        description: "",
      });
      setShowAddModal(false);
      setFormErrors({});
      showSuccess("Role created successfully!");
    } catch (err: any) {
      console.error("Role creation error details:", err);
      const errorData = err.response?.data;
      const errorMsg = errorData?.error || errorData?.message || "Failed to create role";
      
      // Handle backend validation errors (from Joi validator)
      if (errorData?.error && typeof errorData.error === "object" && !Array.isArray(errorData.error)) {
        const backendErrors: Record<string, string> = {};
        Object.keys(errorData.error).forEach((key) => {
          const errorMessages = errorData.error[key];
          if (Array.isArray(errorMessages) && errorMessages.length > 0) {
            backendErrors[key] = errorMessages[0];
            setError(key as any, {
              type: "manual",
              message: errorMessages[0],
            });
          } else if (typeof errorMessages === "string") {
            backendErrors[key] = errorMessages;
            setError(key as any, {
              type: "manual",
              message: errorMessages,
            });
          }
        });
        setFormErrors(backendErrors);
      } else {
        // Generic error - try to map to specific fields
        const lowerError = errorMsg.toLowerCase();
        if (lowerError.includes("name") || lowerError.includes("role name")) {
          setError("name", {
            type: "manual",
            message: errorMsg,
          });
          setFormErrors({ name: errorMsg });
        } else if (lowerError.includes("label") || lowerError.includes("role label")) {
          setError("label", {
            type: "manual",
            message: errorMsg,
          });
          setFormErrors({ label: errorMsg });
        } else if (lowerError.includes("description")) {
          setError("description", {
            type: "manual",
            message: errorMsg,
          });
          setFormErrors({ description: errorMsg });
        } else {
          // Show generic error in alert
          showError(errorMsg);
        }
      }
      console.error("Error creating role:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter roles based on current user's permissions
  const availableRoles = roles.filter((role) => {
    if (currentUserRole === "superadmin") {
      return true; // SuperAdmin can see all roles
    }
    // Admin can see all except superadmin
    if (currentUserRole === "admin") {
      return role.name !== "superadmin";
    }
    // Others can see cashier, warehouse_manager, and custom roles
    return role.name === "cashier" || role.name === "warehouse_manager" || role.isCustom === true;
  });

  const roleOptions = availableRoles.map((role) => ({
    value: role.name,
    label: role.label,
  }));

  // Add "Add New Role" option only for superadmin and admin
  if (currentUserRole === "superadmin" || currentUserRole === "admin") {
    roleOptions.push({
      value: "__add_new__",
      label: "+ Add New Role",
    });
  }

  const handleSelectChange = (selectedValue: string) => {
    if (selectedValue === "__add_new__") {
      setShowAddModal(true);
    } else {
      onChange(selectedValue as UserRole);
    }
  };

  if (isLoading) {
    return (
      <Select
        value={value}
        onChange={(val) => onChange(val as UserRole)}
        options={[{ value: value, label: value }]}
        className={className}
      />
    );
  }

  return (
    <>
      <div className="relative">
        <Select
          value={value}
          onChange={handleSelectChange}
          options={roleOptions}
          placeholder="Select role"
          className={className}
        />
      </div>

      {/* Add Role Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30 py-8">
          <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-lg dark:bg-gray-800 max-h-[90vh] overflow-y-auto">
            <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white">
              Add New Role
            </h3>
            <div className="space-y-4">
              <div>
                <Label>
                  Role Name (lowercase, underscore allowed) <span className="text-error-500">*</span>
                </Label>
                <Input
                  name="name"
                  value={formData.name}
                  onChange={(e) => {
                    const value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "");
                    setValue("name", value);
                    if (formErrors.name) {
                      setFormErrors({ ...formErrors, name: "" });
                      clearErrors("name");
                    }
                  }}
                  onBlur={register("name").onBlur}
                  placeholder="e.g., manager, sales_executive"
                  required
                  error={!!errors.name || !!formErrors.name}
                  hint={errors.name?.message || formErrors.name}
                />
                <p className="mt-1 text-xs text-gray-500">Only lowercase letters, numbers, and underscores</p>
              </div>

              <div>
                <Label>
                  Role Label (Display Name) <span className="text-error-500">*</span>
                </Label>
                <Input
                  name="label"
                  value={formData.label}
                  onChange={(e) => {
                    setValue("label", e.target.value);
                    if (formErrors.label) {
                      setFormErrors({ ...formErrors, label: "" });
                      clearErrors("label");
                    }
                  }}
                  onBlur={register("label").onBlur}
                  placeholder="e.g., Manager, Sales Executive"
                  required
                  error={!!errors.label || !!formErrors.label}
                  hint={errors.label?.message || formErrors.label}
                />
              </div>

              <div>
                <Label>Description (Optional)</Label>
                <Input
                  name="description"
                  value={formData.description}
                  onChange={(e) => {
                    setValue("description", e.target.value);
                    if (formErrors.description) {
                      setFormErrors({ ...formErrors, description: "" });
                      clearErrors("description");
                    }
                  }}
                  onBlur={register("description").onBlur}
                  placeholder="Enter role description"
                  error={!!errors.description || !!formErrors.description}
                  hint={errors.description?.message || formErrors.description}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <Button
                  type="button"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() => handleFormSubmit(handleAddRole)()}
                >
                  {isSubmitting ? "Adding..." : "Add Role"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAddModal(false);
                    reset({
                      name: "",
                      label: "",
                      description: "",
                    });
                    setFormErrors({});
                    clearErrors();
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

