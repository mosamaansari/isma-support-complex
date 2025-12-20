import express, { Router } from "express";
import reportsController from "../controllers/reports.controller";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { queryValidator } from "../middleware/joiValidator";
import { getReportQuerySchema } from "../validators/openingBalance.validator";
import { PERMISSIONS } from "../utils/permissions";

const router = Router();

// Get daily report
router.get(
  "/daily",
  authenticate,
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  queryValidator(getReportQuerySchema),
  reportsController.getDailyReport.bind(reportsController)
);

// Get date range report
router.get(
  "/range",
  authenticate,
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  queryValidator(getReportQuerySchema),
  reportsController.getDateRangeReport.bind(reportsController)
);

// Generate daily report PDF
router.get(
  "/daily/pdf",
  authenticate,
  requirePermission(PERMISSIONS.REPORTS_VIEW),
  queryValidator(getReportQuerySchema),
  reportsController.generateDailyReportPDF.bind(reportsController)
);

export default router;
