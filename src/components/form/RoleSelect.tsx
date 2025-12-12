import { useState, useEffect } from "react";
import Select from "./Select";
import Button from "../ui/button/Button";
import Input from "./input/InputField";
import Label from "./Label";
import { UserRole } from "../../types";
import api from "../../services/api";

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
  const [roles, setRoles] = useState<Array<{ name: string; label: string; description?: string }>>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleLabel, setNewRoleLabel] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      setIsLoading(true);
      const data = await api.getRoles();
      setRoles(data);
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

  const handleAddRole = async () => {
    if (!newRoleName.trim() || !newRoleLabel.trim()) {
      alert("Please enter role name and label");
      return;
    }

    // Validate role name format (lowercase, underscore allowed)
    const roleNameRegex = /^[a-z][a-z0-9_]*$/;
    if (!roleNameRegex.test(newRoleName.trim())) {
      alert("Role name must be lowercase, start with a letter, and can contain underscores");
      return;
    }

    setIsSubmitting(true);
    try {
      // For now, we'll just add it to the local list
      // In a real system, you'd need a custom roles table
      const newRole = {
        name: newRoleName.trim().toLowerCase(),
        label: newRoleLabel.trim(),
        description: newRoleDesc.trim() || undefined,
      };
      
      setRoles([...roles, newRole]);
      onChange(newRole.name as UserRole);
      setNewRoleName("");
      setNewRoleLabel("");
      setNewRoleDesc("");
      setShowAddModal(false);
      alert("Note: Custom roles need to be added to the database enum. This is a temporary addition.");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to create role");
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
    // Others can only see cashier and warehouse_manager
    return role.name === "cashier" || role.name === "warehouse_manager";
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-lg dark:bg-gray-800">
            <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white">
              Add New Role
            </h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Note: Custom roles need to be added to the database enum. This is a temporary addition for display purposes.
            </p>

            <div className="space-y-4">
              <div>
                <Label>
                  Role Name (lowercase, underscore allowed) <span className="text-error-500">*</span>
                </Label>
                <Input
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="e.g., manager, sales_executive"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">Only lowercase letters, numbers, and underscores</p>
              </div>

              <div>
                <Label>
                  Role Label (Display Name) <span className="text-error-500">*</span>
                </Label>
                <Input
                  value={newRoleLabel}
                  onChange={(e) => setNewRoleLabel(e.target.value)}
                  placeholder="e.g., Manager, Sales Executive"
                  required
                />
              </div>

              <div>
                <Label>Description (Optional)</Label>
                <Input
                  value={newRoleDesc}
                  onChange={(e) => setNewRoleDesc(e.target.value)}
                  placeholder="Enter role description"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                type="button"
                size="sm"
                onClick={handleAddRole}
                disabled={isSubmitting || !newRoleName.trim() || !newRoleLabel.trim()}
              >
                {isSubmitting ? "Adding..." : "Add Role"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddModal(false);
                  setNewRoleName("");
                  setNewRoleLabel("");
                  setNewRoleDesc("");
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

