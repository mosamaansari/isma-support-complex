import { Router } from "express";
import cronService from "../services/cron.service";
import logger from "../utils/logger";

const router = Router();

/**
 * Manual cron trigger endpoint
 * This endpoint can be called manually or by external cron services (like Vercel Cron, GitHub Actions, etc.)
 * to trigger the daily opening balance creation
 * 
 * Security: Should be protected with a secret token in production
 * Supports both GET and POST methods (Vercel Cron uses GET by default)
 */
const triggerHandler = async (req: any, res: any) => {
  try {
    // Optional: Add authentication token check for production
    const authToken = req.headers["x-cron-secret"] || req.query.token;
    const expectedToken = process.env.CRON_SECRET_TOKEN;

    // If CRON_SECRET_TOKEN is set in environment, validate it
    if (expectedToken && authToken !== expectedToken) {
      logger.warn("Unauthorized cron trigger attempt");
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Invalid cron secret token",
      });
    }

    logger.info("🕐 Manual cron trigger started via API endpoint");
    const startTime = Date.now();

    // Call the cron service's auto-create function
    await cronService.manualTriggerAutoCreate();

    const duration = Date.now() - startTime;
    logger.info(`✅ Manual cron trigger completed successfully in ${duration}ms`);

    res.status(200).json({
      success: true,
      message: "Cron job executed successfully",
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error("❌ Error in manual cron trigger:", error);
    res.status(500).json({
      success: false,
      message: "Failed to execute cron job",
      error: error.message,
    });
  }
};

// Register the handler for both GET and POST methods
router.get("/trigger", triggerHandler);
router.post("/trigger", triggerHandler);

/**
 * Health check endpoint for cron service
 */
router.get("/status", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Cron service is running",
    timestamp: new Date().toISOString(),
    timezone: "Asia/Karachi (PKT UTC+5)",
    schedule: "0 19 * * * (Daily at 12:00 AM Pakistan Time - Midnight)",
    vercelCron: "Configured in vercel.json",
  });
});

export default router;

