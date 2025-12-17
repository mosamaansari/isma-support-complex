import express, { Router } from "express";
import authController from "../controllers/auth.controller";
import { bodyValidator } from "../middleware/joiValidator";
import { loginSchema, superAdminLoginSchema, forgotPasswordSchema, resetPasswordSchema } from "../validators/auth.validator";

const router = Router();

// Login
router.post("/login", bodyValidator(loginSchema), authController.login.bind(authController));

// SuperAdmin Login
router.post(
  "/superadmin/login",
  bodyValidator(superAdminLoginSchema),
  authController.superAdminLogin.bind(authController)
);

// Logout
router.post("/logout", authController.logout.bind(authController));

// Forgot Password
router.post("/forgot-password", bodyValidator(forgotPasswordSchema), authController.forgotPassword.bind(authController));

// Reset Password
router.post("/reset-password", bodyValidator(resetPasswordSchema), authController.resetPassword.bind(authController));

export default router;
