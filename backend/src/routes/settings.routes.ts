import express, { Router } from "express";
import settingController from "../controllers/settings.controller";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { PERMISSIONS } from "../utils/permissions";

const router = Router();

// Get current settings
router.get("/", authenticate, requirePermission(PERMISSIONS.SETTINGS_VIEW), settingController.getSettings.bind(settingController));

// Update settings
router.put(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  settingController.updateSettings.bind(settingController)
);

export default router;
