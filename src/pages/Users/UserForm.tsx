import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import { useAlert } from "../../context/AlertContext";
import { UserRole } from "../../types";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import RoleSelect from "../../components/form/RoleSelect";
import Button from "../../components/ui/button/Button";
import Checkbox from "../../components/form/input/Checkbox";
import { ChevronLeftIcon } from "../../icons";
import { PERMISSION_GROUPS, getDefaultPermissionsForRole } from "../../utils/availablePermissions";

type FormValues = {
  username?: string;
  password?: string;
  name: string;
  email?: string;
  role: UserRole;
};

// Strict password validation pattern
// Must have: minimum 6 characters, at least one uppercase, one lowercase, one number, and one special character
const strictPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/])[A-Za-z\d@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/]{6,}$/;

const createUserFormSchema = yup.object().shape({
  username: yup
    .string()
    .required("Username is required")
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be less than 50 characters")
    .matches(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  password: yup
    .string()
    .required("Password is required")
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password must be less than 100 characters")
    .matches(
      strictPasswordPattern,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
  name: yup
    .string()
    .required("Full name is required")
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must be less than 100 characters"),
  email: yup
    .string()
    .optional()
    .email("Please enter a valid email address")
    .max(100, "Email must be less than 100 characters"),
  role: yup
    .string()
    .required("Role is required")
    .min(1, "Role must be at least 1 character")
    .max(50, "Role cannot exceed 50 characters"),
});

const editUserFormSchema = yup.object().shape({
  username: yup
    .string()
    .optional()
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be less than 50 characters")
    .matches(/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"),
  password: yup
    .string()
    .optional()
    .test(
      "password-validation",
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character",
      function(value) {
        // Only validate if password is provided and not empty
        if (!value || value.trim().length === 0) {
          return true; // Empty password is allowed (means keep current)
        }
        // If password is provided, it must meet strict requirements
        if (value.length < 6) {
          return this.createError({ message: "Password must be at least 6 characters" });
        }
        if (value.length > 100) {
          return this.createError({ message: "Password must be less than 100 characters" });
        }
        if (!strictPasswordPattern.test(value)) {
          return false; // Will show the main error message
        }
        return true;
      }
    ),
  name: yup
    .string()
    .required("Full name is required")
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must be less than 100 characters")
    .matches(
      /^[a-zA-Z\s'-]+$/,
      "Full name can only contain letters, spaces, hyphens, and apostrophes"
    )
    .test(
      "no-extra-spaces",
      "Full name cannot have multiple consecutive spaces",
      (value) => !value || !/\s{2,}/.test(value)
    )
    .test(
      "not-only-spaces",
      "Full name cannot be only spaces",
      (value) => !value || value.trim().length > 0
    ),
  email: yup
    .string()
    .optional()
    .trim()
    .email("Please enter a valid email address")
    .max(100, "Email must be less than 100 characters")
    .test(
      "not-empty-if-provided",
      "Email cannot be only spaces",
      (value) => !value || value.trim().length === 0 || value.trim().length > 0
    ),
  role: yup
    .string()
    .required("Role is required")
    .min(1, "Role must be at least 1 character")
    .max(50, "Role cannot exceed 50 characters"),
});

export default function UserForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { users, addUser, updateUser, currentUser, loading, error, refreshUsers, usersPagination } = useData();
  const { showError, showSuccess } = useAlert();
  const isEdit = !!id;

  const [permissions, setPermissions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const schema = isEdit ? editUserFormSchema : createUserFormSchema;

  const {
    register,
    handleSubmit: handleFormSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<FormValues>({
    resolver: yupResolver(schema),
    defaultValues: {
      username: "",
      password: "",
      name: "",
      email: "",
      role: "cashier" as UserRole,
    },
  });

  const formData: FormValues = {
    username: watch("username"),
    password: watch("password"),
    name: watch("name") || "",
    email: watch("email"),
    role: (watch("role") as UserRole) || ("cashier" as UserRole),
  };

  useEffect(() => {
    if (isEdit && id) {
      const user = users.find((u) => u.id === id);
      if (user) {
        reset({
          username: user.username,
          name: user.name,
          email: user.email || "",
          role: user.role,
          password: "", // Reset password field to empty
        });
        setPermissions(user.permissions || []);
      }
    } else {
      // Set default permissions for new user based on role
      const defaultPermissions = getDefaultPermissionsForRole(formData.role);
      setPermissions(defaultPermissions);
    }
  }, [isEdit, id, users, reset]);

  // Update permissions when role changes
  useEffect(() => {
    if (!isEdit) {
      const defaultPermissions = getDefaultPermissionsForRole(formData.role);
      setPermissions(defaultPermissions);
    }
  }, [formData.role, isEdit]);

  const onSubmit = async (data: any) => {
    if (currentUser?.role !== "admin" && currentUser?.role !== "superadmin") {
      showError("Only admin or superadmin can manage users");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        const updateData: any = {
          name: data.name.trim(),
          email: data.email?.trim() || undefined,
          role: data.role,
          permissions: permissions,
        };
        // Include password if provided and not empty
        if (data.password && typeof data.password === 'string' && data.password.trim().length > 0) {
          updateData.password = data.password.trim();
        }
        console.log("Updating user with data:", updateData);
        await updateUser(id, updateData);
        showSuccess("User updated successfully!");
      } else {
        await addUser({
          username: data.username.trim(),
          password: data.password,
          name: data.name.trim(),
          email: data.email?.trim() || undefined,
          role: data.role,
          permissions: permissions,
        });
        showSuccess("User created successfully!");
      }
      await refreshUsers(usersPagination?.page || 1, usersPagination?.pageSize || 10);
      navigate("/users");
    } catch (err: any) {
      showError(err.response?.data?.error || "Failed to save user. Please try again.");
      console.error("Error saving user:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePermission = (permission: string) => {
    setPermissions(prev => {
      const hasPermission = prev.includes(permission);
      if (hasPermission) {
        return prev.filter(p => p !== permission);
      } else {
        return [...prev, permission];
      }
    });
  };

  const selectAllInGroup = (groupPermissions: string[]) => {
    setPermissions(prev => {
      const allSelected = groupPermissions.every(p => prev.includes(p));
      if (allSelected) {
        // Deselect all in group
        return prev.filter(p => !groupPermissions.includes(p));
      } else {
        // Select all in group
        const newPermissions = [...prev];
        groupPermissions.forEach(p => {
          if (!newPermissions.includes(p)) {
            newPermissions.push(p);
          }
        });
        return newPermissions;
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

        <form onSubmit={handleFormSubmit(onSubmit)} className="space-y-6">
          {!isEdit && (
            <div>
              <Label>
                Username <span className="text-error-500">*</span>
              </Label>
              <Input
                name="username"
                value={formData.username}
                onChange={(e) => {
                  // Only allow letters, numbers, and underscores
                  const value = e.target.value.replace(/[^a-zA-Z0-9_]/g, "");
                  setValue("username", value);
                }}
                onBlur={register("username").onBlur}
                placeholder="Enter username (letters, numbers, underscores only)"
                required
                error={!!errors.username}
                hint={errors.username?.message}
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
              name="password"
              value={formData.password || ""}
              onChange={(e) => {
                setValue("password", e.target.value, { shouldValidate: false });
              }}
              onBlur={register("password").onBlur}
              placeholder={isEdit ? "Enter new password (leave blank to keep current)" : "Enter password"}
              required={!isEdit}
              error={!!errors.password}
              hint={errors.password?.message || (isEdit ? "Leave blank to keep current password" : "")}
            />
          </div>

          <div>
            <Label>
              Full Name <span className="text-error-500">*</span>
            </Label>
            <Input
              name="name"
              value={formData.name}
              onChange={(e) => {
                // Only allow letters, spaces, hyphens, and apostrophes
                const value = e.target.value.replace(/[^a-zA-Z\s'-]/g, "");
                setValue("name", value);
              }}
              onBlur={register("name").onBlur}
              placeholder="Enter full name (letters, spaces, hyphens, apostrophes only)"
              required
              error={!!errors.name}
              hint={errors.name?.message}
            />
          </div>

          <div>
            <Label>Email</Label>
            <Input
              type="email"
              name="email"
              value={formData.email}
              onChange={(e) => {
                const value = e.target.value.trim();
                setValue("email", value);
              }}
              onBlur={register("email").onBlur}
              placeholder="Enter email (optional)"
              error={!!errors.email}
              hint={errors.email?.message}
            />
          </div>

          <div>
            <Label>
              Role <span className="text-error-500">*</span>
            </Label>
            <RoleSelect
              value={formData.role}
              onChange={(value) => {
                setValue("role", value);
              }}
              currentUserRole={currentUser?.role}
              required
            />
            {errors.role && (
              <p className="mt-1.5 text-xs text-error-500">{errors.role.message}</p>
            )}
          </div>

          {/* Permissions Section */}
          <div className="mt-6">
            <Label className="mb-4">
              Permissions <span className="text-error-500">*</span>
            </Label>
            <div className="p-4 border border-gray-200 rounded-lg dark:border-gray-700 max-h-96 overflow-y-auto">
              {PERMISSION_GROUPS.map((group) => {
                const groupPermissionValues = group.permissions.map(p => p.value);
                const allSelected = groupPermissionValues.every(p => permissions.includes(p));

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
                            checked={permissions.includes(permission.value)}
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
