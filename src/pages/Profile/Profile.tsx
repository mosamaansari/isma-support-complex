import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useDropzone } from "react-dropzone";
import PageMeta from "../../components/common/PageMeta";
import { useData } from "../../context/DataContext";
import { useAlert } from "../../context/AlertContext";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import Button from "../../components/ui/button/Button";
import { UserRole } from "../../types";
import api from "../../services/api";

// Profile information schema
const profileFormSchema = yup.object().shape({
  name: yup
    .string()
    .required("Name is required")
    .trim()
    .min(1, "Name must be at least 1 character")
    .max(255, "Name must be less than 255 characters"),
  email: yup
    .string()
    .optional()
    .email("Please enter a valid email address")
    .max(255, "Email must be less than 255 characters"),
});

// Strict password validation pattern
// Must have: minimum 6 characters, at least one uppercase, one lowercase, one number, and one special character
const strictPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/])[A-Za-z\d@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/]{6,}$/;

// Password change schema
const passwordFormSchema = yup.object().shape({
  currentPassword: yup
    .string()
    .required("Current password is required"),
  newPassword: yup
    .string()
    .required("New password is required")
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password must be less than 100 characters")
    .matches(
      strictPasswordPattern,
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),
  confirmPassword: yup
    .string()
    .required("Please confirm your new password")
    .oneOf([yup.ref("newPassword")], "Passwords must match"),
});

export default function Profile() {
  const { currentUser, error, refreshCurrentUser } = useData();
  const { showSuccess, showError } = useAlert();
  const navigate = useNavigate();

  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>("");

  // Profile form
  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    formState: { errors: profileErrors },
    setValue: setProfileValue,
    watch: watchProfile,
    reset: resetProfile,
  } = useForm({
    resolver: yupResolver(profileFormSchema),
    defaultValues: {
      name: "",
      email: "",
    },
  });

  // Password form
  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors },
    setValue: setPasswordValue,
    setError: setPasswordError,
    watch: watchPassword,
    reset: resetPassword,
  } = useForm({
    resolver: yupResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const profileData = {
    name: watchProfile("name"),
    email: watchProfile("email"),
  };

  const passwordData = {
    currentPassword: watchPassword("currentPassword"),
    newPassword: watchPassword("newPassword"),
    confirmPassword: watchPassword("confirmPassword"),
  };

  useEffect(() => {
    if (currentUser) {
      resetProfile({
        name: currentUser.name || "",
        email: currentUser.email || "",
      });
      if (currentUser.profilePicture) {
        setImagePreview(currentUser.profilePicture);
      }
    }
  }, [currentUser, resetProfile]);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Please login to continue</p>
          <Button onClick={() => navigate("/login")} size="sm">
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setImagePreview(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    onDropRejected: (fileRejections) => {
      fileRejections.forEach((rejection) => {
        const { errors } = rejection;
        errors.forEach((error) => {
          if (error.code === "file-too-large") {
            showError(`File is too large using ${error.code}. Max size is 5MB.`);
          } else if (error.code === "file-invalid-type") {
            showError("Invalid file type. Only PNG, JPG, and WEBP are allowed.");
          } else {
            showError(error.message);
          }
        });
      });
    },
    accept: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/webp": [".webp"],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024, // 5MB
  });

  const onSubmitProfile = async (data: any) => {
    setIsSubmittingProfile(true);
    try {
      const updateData = {
        name: data.name.trim(),
        email: data.email || undefined,
        profilePicture: imagePreview || undefined,
      };

      const updatedUser = await api.updateProfile(updateData);
      showSuccess("Profile information updated successfully!");

      // Update currentUser in context from localStorage
      refreshCurrentUser();

      // Update form with new data
      resetProfile({
        name: updatedUser.name || "",
        email: updatedUser.email || "",
      });

      // Update image preview if profile picture was updated
      if (updatedUser.profilePicture) {
        setImagePreview(updatedUser.profilePicture);
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.response?.data?.message || "Failed to update profile. Please try again.";
      showError(errorMsg);
      console.error("Error updating profile:", err);
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  const onSubmitPassword = async (data: any) => {
    setIsSubmittingPassword(true);
    try {
      await api.updatePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        confirmPassword: data.confirmPassword,
      });

      showSuccess("Password updated successfully!");

      // Clear password fields
      resetPassword({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || err.response?.data?.message || "Failed to update password. Please try again.";

      // Check if it's a current password error
      if (errorMsg.toLowerCase().includes("current password") ||
        errorMsg.toLowerCase().includes("incorrect") ||
        err.response?.status === 401) {
        // Set error on currentPassword field
        setPasswordError("currentPassword", {
          type: "manual",
          message: errorMsg,
        });
      } else if (errorMsg.toLowerCase().includes("passwords must match")) {
        // Set error on confirmPassword field
        setPasswordError("confirmPassword", {
          type: "manual",
          message: errorMsg,
        });
      } else {
        // Generic error - show in alert
        showError(errorMsg);
      }

      console.error("Error updating password:", err);
    } finally {
      setIsSubmittingPassword(false);
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
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  return (
    <>
      <PageMeta
        title="Profile | Isma Sports Complex"
        description="View and edit your profile"
      />
      <div className="max-w-4xl p-6 bg-white rounded-lg shadow-sm dark:bg-gray-800">
        <h1 className="mb-6 text-2xl font-bold text-gray-800 dark:text-white">
          Profile Settings
        </h1>

        {error && (
          <div className="mb-4 p-4 bg-red-50 rounded-lg dark:bg-red-900/20">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Profile Information Form */}
        <form onSubmit={handleProfileSubmit(onSubmitProfile)} className="space-y-6">
          <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
            Profile Information
          </h2>

          {/* Profile Picture */}
          <div>
            <Label>Profile Picture</Label>
            <div
              {...getRootProps()}
              className={`mt-2 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${imagePreview
                  ? "border-transparent border-0 inline-block"
                  : "border-gray-300 hover:border-brand-400 dark:border-gray-700 p-6"
                }`}
            >
              <input {...getInputProps()} />
              {imagePreview ? (
                <div className="relative inline-block group">
                  <img
                    src={imagePreview}
                    alt="Profile preview"
                    className="h-32 w-32 object-cover rounded-full border-4 border-gray-200 dark:border-gray-700"
                  />
                  <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-xs font-medium">Change</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setImagePreview("");
                      // Optionally reset the file input if needed, though react-dropzone handles this well usually
                    }}
                    className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 z-10"
                    title="Remove image"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    Click to upload or drag and drop
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    PNG, JPG, WEBP up to 5MB
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* User Info */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>
                Full Name <span className="text-error-500">*</span>
              </Label>
              <Input
                name="name"
                value={profileData.name}
                onChange={(e) => {
                  setProfileValue("name", e.target.value);
                }}
                onBlur={registerProfile("name").onBlur}
                placeholder="Enter your full name"
                required
                error={!!profileErrors.name}
                hint={profileErrors.name?.message}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                name="email"
                value={profileData.email}
                onChange={(e) => {
                  setProfileValue("email", e.target.value);
                }}
                onBlur={registerProfile("email").onBlur}
                placeholder="Enter your email (optional)"
                error={!!profileErrors.email}
                hint={profileErrors.email?.message}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Username</Label>
              <Input
                value={currentUser?.username || ""}
                disabled
                placeholder="Username (cannot be changed)"
                className="bg-gray-100 dark:bg-gray-700"
              />
            </div>
            <div>
              <Label>Role</Label>
              <div className="mt-2">
                <span
                  className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(
                    currentUser.role
                  )}`}
                >
                  {currentUser.role}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button type="submit" size="sm" disabled={isSubmittingProfile}>
              {isSubmittingProfile ? "Updating..." : "Update Profile Information"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => navigate("/")}
              disabled={isSubmittingProfile}
            >
              Cancel
            </Button>
          </div>
        </form>

        {/* Password Change Form */}
        <form onSubmit={handlePasswordSubmit(onSubmitPassword)} className="space-y-6 mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <h2 className="mb-4 text-xl font-semibold text-gray-800 dark:text-white">
            Change Password
          </h2>
          <div className="space-y-4">
            <div>
              <Label>
                Current Password <span className="text-error-500">*</span>
              </Label>
              <Input
                type="password"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={(e) => {
                  setPasswordValue("currentPassword", e.target.value);
                }}
                onBlur={registerPassword("currentPassword").onBlur}
                placeholder="Enter current password"
                required
                error={!!passwordErrors.currentPassword}
                hint={passwordErrors.currentPassword?.message}
              />
            </div>
            <div>
              <Label>
                New Password <span className="text-error-500">*</span>
              </Label>
              <Input
                type="password"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={(e) => {
                  setPasswordValue("newPassword", e.target.value);
                }}
                onBlur={registerPassword("newPassword").onBlur}
                placeholder="Enter new password (min 6 characters)"
                required
                error={!!passwordErrors.newPassword}
                hint={passwordErrors.newPassword?.message}
              />
            </div>
            <div>
              <Label>
                Confirm New Password <span className="text-error-500">*</span>
              </Label>
              <Input
                type="password"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={(e) => {
                  setPasswordValue("confirmPassword", e.target.value);
                }}
                onBlur={registerPassword("confirmPassword").onBlur}
                placeholder="Confirm new password"
                required
                error={!!passwordErrors.confirmPassword}
                hint={passwordErrors.confirmPassword?.message}
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" size="sm" disabled={isSubmittingPassword}>
              {isSubmittingPassword ? "Updating..." : "Update Password"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                resetPassword({
                  currentPassword: "",
                  newPassword: "",
                  confirmPassword: "",
                });
              }}
              disabled={isSubmittingPassword}
            >
              Clear
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
