import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import api from "../../services/api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid or missing reset token. Please request a new password reset link.");
    }
  }, [token]);

  // Strict password validation pattern
  // Must have: minimum 6 characters, at least one uppercase, one lowercase, one number, and one special character
  const strictPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/])[A-Za-z\d@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/]{6,}$/;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Invalid or missing reset token.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    if (!strictPasswordPattern.test(newPassword)) {
      setError("Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);
    try {
      await api.resetPassword(token, newPassword, "user");
      setSuccess(true);
      setTimeout(() => {
        navigate("/login");
      }, 3000);
    } catch (error: any) {
      setError(error.response?.data?.error || "Failed to reset password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <>
        <PageMeta
          title="Password Reset Successful | Isma Sports Complex"
          description="Password reset successful - Isma Sports Complex"
        />
        <AuthLayout>
          <div className="flex flex-col flex-1">
            <div className="flex items-center justify-center flex-1 px-4 py-12 sm:px-6 lg:px-8">
              <div className="w-full max-w-md">
                <div className="p-8 bg-white rounded-2xl shadow-default dark:bg-gray-900">
                  <div className="p-4 bg-green-50 rounded-lg dark:bg-green-900/20">
                    <h2 className="mb-2 text-lg font-semibold text-green-800 dark:text-green-400">
                      Password Reset Successful!
                    </h2>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Your password has been successfully reset. You will be redirected to the login page in a few seconds.
                    </p>
                  </div>
                  <div className="mt-6">
                    <Button
                      onClick={() => navigate("/login")}
                      className="w-full"
                      size="sm"
                    >
                      Go to Login
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </AuthLayout>
      </>
    );
  }

  return (
    <>
      <PageMeta
        title="Reset Password | Isma Sports Complex"
        description="Reset your password - Isma Sports Complex"
      />
      <AuthLayout>
        <div className="flex flex-col flex-1">
          <div className="flex items-center justify-center flex-1 px-4 py-12 sm:px-6 lg:px-8">
            <div className="w-full max-w-md">
              <div className="p-8 bg-white rounded-2xl shadow-default dark:bg-gray-900">
                <div className="mb-8 text-center">
                  <h1 className="mb-2 text-2xl font-bold text-gray-800 dark:text-white">
                    Reset Password
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Enter your new password below
                  </p>
                </div>

                {error && (
                  <div className="p-4 mb-6 bg-red-50 rounded-lg dark:bg-red-900/20">
                    <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit}>
                  <div className="space-y-6">
                    <div>
                      <Label>
                        New Password <span className="text-error-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter new password (min 6 chars: uppercase, lowercase, number, special char)"
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          {showPassword ? (
                            <EyeCloseIcon className="size-5" />
                          ) : (
                            <EyeIcon className="size-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <Label>
                        Confirm Password <span className="text-error-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                          {showConfirmPassword ? (
                            <EyeCloseIcon className="size-5" />
                          ) : (
                            <EyeIcon className="size-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <Button type="submit" className="w-full" size="sm" loading={isLoading} disabled={isLoading || !token}>
                        Reset Password
                      </Button>
                    </div>
                  </div>
                </form>

                <div className="mt-5">
                  <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400">
                    Remember your password?{" "}
                    <Link
                      to="/login"
                      className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
                    >
                      Sign In
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AuthLayout>
    </>
  );
}






