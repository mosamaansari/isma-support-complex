import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useDropzone } from "react-dropzone";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Button from "../../components/ui/button/Button";
import { UserRole } from "../../types";
export default function Profile() {
  const { currentUser, updateUser, error } = useData();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    username: "",
    role: "" as UserRole | "",
    profilePicture: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [imagePreview, setImagePreview] = useState<string>("");

  useEffect(() => {
    if (currentUser) {
      setFormData({
        name: currentUser.name || "",
        email: currentUser.email || "",
        username: currentUser.username || "",
        role: currentUser.role || "",
        profilePicture: currentUser.profilePicture || "",
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    }
  }, [currentUser]);

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setFormData({ ...formData, profilePicture: result });
      };
      reader.readAsDataURL(file);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/webp": [".webp"],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024, // 5MB
  });

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Please login to continue</p>
          <Button onClick={() => navigate("/signin")} size="sm">
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    // Validate password if changing
    if (formData.newPassword || formData.confirmPassword) {
      if (formData.newPassword !== formData.confirmPassword) {
        setPasswordError("New passwords do not match");
        return;
      }
      if (formData.newPassword.length < 6) {
        setPasswordError("Password must be at least 6 characters");
        return;
      }
      if (!formData.currentPassword) {
        setPasswordError("Please enter current password to change password");
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const updateData: any = {
        name: formData.name,
        email: formData.email || undefined,
        profilePicture: formData.profilePicture || undefined,
      };

      // Only update password if new password is provided
      if (formData.newPassword && formData.currentPassword) {
        updateData.password = formData.newPassword;
        updateData.currentPassword = formData.currentPassword;
      }

      await updateUser(currentUser.id, updateData);
      alert("Profile updated successfully!");
      
      // Clear password fields
      setFormData(prev => ({
        ...prev,
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      }));
      
      // Refresh user data to get updated profile picture
      window.location.reload();
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || "Failed to update profile. Please try again.";
      alert(errorMsg);
      console.error("Error updating profile:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case "superadmin":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400";
      case "admin":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400";
      case "cashier":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      case "warehouse_manager":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  return (
    <>
      <PageMeta
        title="Profile | Isma Sports Complex"
        description="User profile and settings"
      />
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          My Profile
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Manage your account information and password
        </p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 rounded-lg dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile Information Card */}
        <div className="lg:col-span-2">
          <div className="p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <h2 className="mb-6 text-lg font-semibold text-gray-800 dark:text-white">
              Profile Information
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Username (Read-only) */}
              <div>
                <Label>Username</Label>
                <Input
                  value={formData.username}
                  disabled
                  className="bg-gray-50 dark:bg-gray-900 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Username cannot be changed
                </p>
              </div>

              {/* Full Name */}
              <div>
                <Label>
                  Full Name <span className="text-error-500">*</span>
                </Label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Enter your full name"
                  required
                />
              </div>

              {/* Email */}
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="Enter your email (optional)"
                />
              </div>

              {/* Role (Read-only) */}
              <div>
                <Label>Role</Label>
                <div className="mt-2">
                  <span
                    className={`inline-block px-3 py-1 text-sm font-medium rounded ${getRoleBadgeColor(
                      formData.role as UserRole
                    )}`}
                  >
                    {formData.role.replace("_", " ")}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Role cannot be changed. Contact administrator for role changes.
                </p>
              </div>

              {/* Password Section */}
              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white">
                  Change Password
                </h3>
                <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                  Leave blank if you don't want to change your password
                </p>

                {passwordError && (
                  <div className="mb-4 p-3 bg-red-50 rounded-lg dark:bg-red-900/20">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {passwordError}
                    </p>
                  </div>
                )}

                {/* Current Password */}
                <div className="mb-4">
                  <Label>Current Password</Label>
                  <Input
                    type="password"
                    value={formData.currentPassword}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        currentPassword: e.target.value,
                      })
                    }
                    placeholder="Enter current password"
                  />
                </div>

                {/* New Password */}
                <div className="mb-4">
                  <Label>New Password</Label>
                  <Input
                    type="password"
                    value={formData.newPassword}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        newPassword: e.target.value,
                      });
                      setPasswordError("");
                    }}
                    placeholder="Enter new password (min 6 characters)"
                  />
                </div>

                {/* Confirm Password */}
                <div>
                  <Label>Confirm New Password</Label>
                  <Input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        confirmPassword: e.target.value,
                      })
                    }
                    placeholder="Confirm new password"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex gap-4 pt-4">
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFormData({
                      name: currentUser.name || "",
                      email: currentUser.email || "",
                      username: currentUser.username || "",
                      role: currentUser.role || "",
                      profilePicture: currentUser.profilePicture || "",
                      currentPassword: "",
                      newPassword: "",
                      confirmPassword: "",
                    });
                    setPasswordError("");
                  }}
                  disabled={isSubmitting}
                >
                  Reset
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Account Summary Card */}
        <div>
          <div className="p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
            <h2 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white">
              Account Summary
            </h2>

            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Account Created
                </p>
                <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white">
                  {currentUser.createdAt
                    ? new Date(currentUser.createdAt).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  User ID
                </p>
                <p className="mt-1 text-sm font-medium text-gray-800 dark:text-white font-mono">
                  {currentUser.id.substring(0, 8)}...
                </p>
              </div>

              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  Permissions
                </p>
                <p className="text-sm font-medium text-gray-800 dark:text-white">
                  {currentUser.permissions && currentUser.permissions.length > 0
                    ? `${currentUser.permissions.length} custom permission(s)`
                    : "Default role permissions"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

