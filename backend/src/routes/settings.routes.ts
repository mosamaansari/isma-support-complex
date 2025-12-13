import express, { Router } from "express";
import settingsController from "../controllers/settings.controller";
import { authenticate, authorize } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { updateSettingsSchema } from "../validators/settings.validator";

const router = Router();

// Get settings
router.get("/", authenticate, settingsController.getSettings.bind(settingsController));

// Update settings
router.put(
  "/",
  authenticate,
  authorize("superadmin", "admin"),
  validate(updateSettingsSchema),
  settingsController.updateSettings.bind(settingsController)
);

export default router;
