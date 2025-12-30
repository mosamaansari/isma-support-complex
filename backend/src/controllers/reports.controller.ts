import { Response } from "express";
import reportService from "../services/report.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class ReportsController {
  async getDailyReport(req: AuthRequest, res: Response) {
    try {
      const { date } = req.query;
      console.log("Received date for daily report:", date);
      if (!date || typeof date !== "string") {
        return res.status(400).json({ error: "Date parameter is required" });
      }

      const report = await reportService.getDailyReport(date);
      res.json(report);
    } catch (error: any) {
      logger.error("Get daily report error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }

  async getDateRangeReport(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || typeof startDate !== "string") {
        return res.status(400).json({ error: "Start date parameter is required" });
      }

      if (!endDate || typeof endDate !== "string") {
        return res.status(400).json({ error: "End date parameter is required" });
      }

      const report = await reportService.getDateRangeReport(startDate, endDate);
      res.json(report);
    } catch (error: any) {
      logger.error("Get date range report error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }

  async generateDailyReportPDF(req: AuthRequest, res: Response) {
    try {
      const { date } = req.query;

      if (!date || typeof date !== "string") {
        return res.status(400).json({ error: "Date parameter is required" });
      }

      await reportService.generateDailyReportPDF(date, res);
    } catch (error: any) {
      logger.error("Generate daily report PDF error:", error);
      if (!res.writableEnded) {
        res.status(500).json({ error: error.message || "Internal server error" });
      }
    }
  }
}

export default new ReportsController();








