import { Router } from "express";
import backupController from "../controllers/backup.controller";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { PERMISSIONS } from "../utils/permissions";

const router = Router();

// Export all data (Admin only)
router.get(
  "/export-all-excel",
  authenticate,
  requirePermission(PERMISSIONS.BACKUP_EXPORT),
  backupController.exportAllData.bind(backupController)
);

// Import all data (Admin only)
router.post(
  "/import-all",
  authenticate,
  requirePermission(PERMISSIONS.BACKUP_EXPORT),
  backupController.importAllData.bind(backupController)
);

// Export report to Excel
router.post(
  "/report/excel",
  authenticate,
  requirePermission(PERMISSIONS.BACKUP_EXPORT),
  backupController.exportReportToExcel.bind(backupController)
);

export default router;

