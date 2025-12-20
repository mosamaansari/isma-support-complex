import express, { Router } from "express";
import dailyConfirmationController from "../controllers/dailyConfirmation.controller";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { PERMISSIONS } from "../utils/permissions";

const router = Router();

// Check if daily confirmation is needed
router.get(
  "/check",
  authenticate,
  requirePermission(PERMISSIONS.DAILY_CONFIRMATION_VIEW),
  dailyConfirmationController.checkConfirmation.bind(dailyConfirmationController)
);

// Confirm daily opening balance
router.post(
  "/confirm",
  authenticate,
  requirePermission(PERMISSIONS.DAILY_CONFIRMATION_CONFIRM),
  dailyConfirmationController.confirmDaily.bind(dailyConfirmationController)
);

export default router;

