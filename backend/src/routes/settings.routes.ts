import express, { Router } from "express";
import settingsController from "../controllers/settings.controller";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { bodyValidator } from "../middleware/joiValidator";
import { updateSettingsSchema } from "../validators/settings.validator";
import { PERMISSIONS } from "../utils/permissions";

const router = Router();

// Get settings
router.get("/", authenticate, settingsController.getSettings.bind(settingsController));

// Update settings
router.put(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.SETTINGS_UPDATE),
  bodyValidator(updateSettingsSchema),
  settingsController.updateSettings.bind(settingsController)
);

export default router;
