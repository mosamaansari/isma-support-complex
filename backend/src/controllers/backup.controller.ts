import { Response } from "express";
import backupService from "../services/backup.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class BackupController {
  async exportAllData(req: AuthRequest, res: Response) {
    try {
      const jsonData = await backupService.exportAllData();
      const timestamp = new Date().toISOString().split("T")[0];

      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename=isma-sports-backup-${timestamp}.json`);

      res.send(jsonData);
      logger.info(`Data backup exported by ${req.user?.username}`);
    } catch (error: any) {
      logger.error("Export data error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async importAllData(req: AuthRequest, res: Response) {
    try {
      const importResult = await backupService.importAllData(req.body);
      logger.info(`Data backup imported by ${req.user?.username}`);
      return res.status(200).json({
        message: "Data imported successfully",
        response: {
          data: importResult,
        },
        error: null,
      });
    } catch (error: any) {
      logger.error("Import data error:", error);
      return res.status(500).json({
        message: error.message || "Failed to import data",
        response: null,
        error: error.message || "Internal server error",
      });
    }
  }

  async exportReportToExcel(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      
      // Get report data (you can enhance this to fetch actual data)
      const reportData = {
        dateRange: {
          start: startDate as string,
          end: endDate as string,
        },
        summary: req.body.summary || {},
        sales: req.body.sales || [],
        expenses: req.body.expenses || [],
      };

      const excelBuffer = await backupService.exportReportToExcel(reportData);
      const timestamp = new Date().toISOString().split("T")[0];

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=report-${startDate || "all"}-${endDate || "all"}-${timestamp}.xlsx`
      );

      res.send(excelBuffer);
      logger.info(`Report exported to Excel by ${req.user?.username}`);
    } catch (error: any) {
      logger.error("Export report to Excel error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

export default new BackupController();






