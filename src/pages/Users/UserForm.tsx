import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import { UserRole } from "../../types";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import RoleSelect from "../../components/form/RoleSelect";
import Button from "../../components/ui/button/Button";
import Checkbox from "../../components/form/input/Checkbox";
import { ChevronLeftIcon } from "../../icons";
import { PERMISSION_GROUPS, getDefaultPermissionsForRole } from "../../utils/availablePermissions";

export default function UserForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { users, addUser, updateUser, currentUser, loading, error, refreshUsers } = useData();
  const isEdit = !!id;

  const [formData, setFormData] = useState({
    username: "",
    password: "",
    name: "",
    email: "",
    role: "cashier" as UserRole,
    permissions: [] as string[],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isEdit && id) {
      const user = users.find((u) => u.id === id);
      if (user) {
        setFormData({
          username: user.username,
          password: "", // Don't show password
          name: user.name,
          email: user.email || "",
          role: user.role,
          permissions: user.permissions || [],
        });
      }
    } else {
      // Set default permissions for new user based on role
      setFormData(prev => ({
        ...prev,
        permissions: getDefaultPermissionsForRole(prev.role),
      }));
    }
  }, [isEdit, id, users]);

  // Update permissions when role changes
  useEffect(() => {
    if (!isEdit) {
      setFormData(prev => ({
        ...prev,
        permissions: getDefaultPermissionsForRole(prev.role),
      }));
    }
  }, [formData.role, isEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (currentUser?.role !== "admin" && currentUser?.role !== "superadmin") {
      alert("Only admin or superadmin can manage users");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        const updateData: any = {
          name: formData.name,
          email: formData.email,
          role: formData.role,
          permissions: formData.permissions,
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        await updateUser(id, updateData);
      } else {
        await addUser({
          username: formData.username,
          password: formData.password,
          name: formData.name,
          email: formData.email || undefined,
          role: formData.role,
          permissions: formData.permissions,
        });
      }
      await refreshUsers();
      navigate("/users");
    } catch (err: any) {
      alert(err.response?.data?.error || "Failed to save user. Please try again.");
      console.error("Error saving user:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePermission = (permission: string) => {
    setFormData(prev => {
      const hasPermission = prev.permissions.includes(permission);
      if (hasPermission) {
        return {
          ...prev,
          permissions: prev.permissions.filter(p => p !== permission),
        };
      } else {
        return {
          ...prev,
          permissions: [...prev.permissions, permission],
        };
      }
    });
  };

  const selectAllInGroup = (groupPermissions: string[]) => {
    setFormData(prev => {
      const allSelected = groupPermissions.every(p => prev.permissions.includes(p));
      if (allSelected) {
        // Deselect all in group
        return {
          ...prev,
          permissions: prev.permissions.filter(p => !groupPermissions.includes(p)),
        };
      } else {
        // Select all in group
        const newPermissions = [...prev.permissions];
        groupPermissions.forEach(p => {
          if (!newPermissions.includes(p)) {
            newPermissions.push(p);
          }
        });
        return {
          ...prev,
          permissions: newPermissions,
        };
      }
    });
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Please login to continue</p>
        </div>
      </div>
    );
  }

  if (currentUser?.role !== "admin" && currentUser?.role !== "superadmin") {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 dark:text-red-400">
          Access denied. Admin or SuperAdmin privileges required.
        </p>
      </div>
    );
  }

  if (loading && users.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-500">Loading user data...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title={`${isEdit ? "Edit" : "Add"} User | Isma Sports Complex`}
        description={`${isEdit ? "Edit" : "Add"} user account`}
      />
      <div className="mb-6">
        <Link to="/users">
          <Button variant="outline" size="sm">
            <ChevronLeftIcon className="w-4 h-4 mr-2" />
            Back to Users
          </Button>
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 rounded-lg dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="max-w-4xl p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
        <h1 className="mb-6 text-2xl font-bold text-gray-800 dark:text-white">
          {isEdit ? "Edit User" : "Add New User"}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {!isEdit && (
            <div>
              <Label>
                Username <span className="text-error-500">*</span>
              </Label>
              <Input
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                placeholder="Enter username"
                required
              />
            </div>
          )}

          <div>
            <Label>
              {isEdit ? "New Password (leave blank to keep current)" : "Password"}{" "}
              {!isEdit && <span className="text-error-500">*</span>}
            </Label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              placeholder="Enter password"
              required={!isEdit}
            />
          </div>

          <div>
            <Label>
              Full Name <span className="text-error-500">*</span>
            </Label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="Enter full name"
              required
            />
          </div>

          <div>
            <Label>Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="Enter email (optional)"
            />
          </div>

          <div>
            <Label>
              Role <span className="text-error-500">*</span>
            </Label>
            <RoleSelect
              value={formData.role}
              onChange={(value) =>
                setFormData({ ...formData, role: value })
              }
              currentUserRole={currentUser?.role}
              required
            />
          </div>

          {/* Permissions Section */}
          <div className="mt-6">
            <Label className="mb-4">
              Permissions <span className="text-error-500">*</span>
            </Label>
            <div className="p-4 border border-gray-200 rounded-lg dark:border-gray-700 max-h-96 overflow-y-auto">
              {PERMISSION_GROUPS.map((group) => {
                const groupPermissionValues = group.permissions.map(p => p.value);
                const allSelected = groupPermissionValues.every(p => formData.permissions.includes(p));

                return (
                  <div key={group.group} className="mb-6 last:mb-0">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-800 dark:text-white">
                        {group.group}
                      </h3>
                      <button
                        type="button"
                        onClick={() => selectAllInGroup(groupPermissionValues)}
                        className="text-sm text-brand-600 hover:text-brand-700 dark:text-brand-400"
                      >
                        {allSelected ? "Deselect All" : "Select All"}
                      </button>
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      {group.permissions.map((permission) => (
                        <label
                          key={permission.key}
                          className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={formData.permissions.includes(permission.value)}
                            onChange={() => togglePermission(permission.value)}
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {permission.label}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Select the permissions this user should have. Permissions are automatically set based on role, but you can customize them.
            </p>
          </div>

          <div className="flex gap-4 mt-6">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : isEdit ? "Update User" : "Add User"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/users")}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

