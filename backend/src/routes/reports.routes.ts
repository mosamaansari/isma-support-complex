import express, { Router } from "express";
import reportsController from "../controllers/reports.controller";
import { authenticate } from "../middleware/auth";
import { validateQuery } from "../middleware/validate";
import { getReportQuerySchema } from "../validators/openingBalance.validator";

const router = Router();

// Get daily report
router.get(
  "/daily",
  authenticate,
  validateQuery(getReportQuerySchema),
  reportsController.getDailyReport.bind(reportsController)
);

// Get date range report
router.get(
  "/range",
  authenticate,
  validateQuery(getReportQuerySchema),
  reportsController.getDateRangeReport.bind(reportsController)
);

export default router;
