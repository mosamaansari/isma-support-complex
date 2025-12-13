import express, { Router } from "express";
import authController from "../controllers/auth.controller";
import { validate } from "../middleware/validate";
import { loginSchema, superAdminLoginSchema } from "../validators/auth.validator";

const router = Router();

// Login
router.post("/login", validate(loginSchema), authController.login.bind(authController));

// SuperAdmin Login
router.post(
  "/superadmin/login",
  validate(superAdminLoginSchema),
  authController.superAdminLogin.bind(authController)
);

// Logout
router.post("/logout", authController.logout.bind(authController));

export default router;
