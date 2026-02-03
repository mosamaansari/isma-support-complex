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
  dailyConfirmationController.checkConfirmation.bind(dailyConfirmationController)
);

// Confirm daily opening balance
router.post(
  "/confirm",
  authenticate,
  dailyConfirmationController.confirmDaily.bind(dailyConfirmationController)
);

export default router;
