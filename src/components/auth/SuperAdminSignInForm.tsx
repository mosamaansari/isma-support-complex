import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import Label from "../form/Label";
import Input from "../form/input/InputField";
import Checkbox from "../form/input/Checkbox";
import Button from "../ui/button/Button";
import { useData } from "../../context/DataContext";

const superAdminSignInSchema = yup.object().shape({
  username: yup
    .string()
    .required("Username is required")
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must be less than 50 characters"),
  password: yup
    .string()
    .required("Password is required")
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password must be less than 100 characters"),
});

export default function SuperAdminSignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { superAdminLogin, currentUser, error: contextError } = useData();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit: handleFormSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm({
    resolver: yupResolver(superAdminSignInSchema),
    defaultValues: {
      username: "superadmin",
      password: "superadmin123",
    },
  });

  const username = watch("username");
  const password = watch("password");

  // Check if already logged in (superadmin or admin)
  useEffect(() => {
    if (currentUser && (currentUser.role === "superadmin" || currentUser.role === "admin")) {
      navigate("/", { replace: true });
    }
  }, [currentUser, navigate]);

  // Show context errors
  useEffect(() => {
    if (contextError) {
      setError(contextError);
    }
  }, [contextError]);

  const onSubmit = async (data: any) => {
    setError("");
    setIsLoading(true);
    try {
      const success = await superAdminLogin(data.username, data.password);
      if (success) {
        navigate("/");
      } else {
        setError("SuperAdmin login failed. Please check your credentials.");
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "SuperAdmin login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1">
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div>
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              Admin Sign In
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your admin credentials to sign in!
            </p>
          </div>
          <div>
            <form onSubmit={handleFormSubmit(onSubmit)}>
              <div className="space-y-6">
                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg dark:bg-red-900/20 dark:text-red-400">
                    {error}
                  </div>
                )}
                <div>
                  <Label>
                    Username <span className="text-error-500">*</span>{" "}
                  </Label>
                  <Input
                    name="username"
                    value={username}
                    onChange={(e) => {
                      setValue("username", e.target.value);
                    }}
                    onBlur={register("username").onBlur}
                    placeholder="Enter admin username"
                    required
                    error={!!errors.username}
                    hint={errors.username?.message}
                  />
                </div>
                <div>
                  <Label>
                    Password <span className="text-error-500">*</span>{" "}
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      value={password}
                      onChange={(e) => {
                        setValue("password", e.target.value);
                      }}
                      onBlur={register("password").onBlur}
                      placeholder="Enter your password"
                      required
                      error={!!errors.password}
                      hint={errors.password?.message}
                    />
                    <span
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                    >
                      {showPassword ? (
                        <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      ) : (
                        <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox checked={isChecked} onChange={setIsChecked} />
                  <span className="block font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                    Keep me logged in
                  </span>
                </div>
                <div>
                  <Button type="submit" className="w-full" size="sm" disabled={isLoading}>
                    {isLoading ? "Signing in..." : "Sign in as Admin"}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
