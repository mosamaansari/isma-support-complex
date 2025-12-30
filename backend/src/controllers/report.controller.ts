import { Request, Response } from "express";
import reportService from "../services/report.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class ReportController {
  async getSalesReport(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const filters = {
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      };
      const report = await reportService.getSalesReport(filters);
      res.json(report);
    } catch (error: any) {
      logger.error("Get sales report error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getExpensesReport(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const filters = {
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      };
      const report = await reportService.getExpensesReport(filters);
      res.json(report);
    } catch (error: any) {
      logger.error("Get expenses report error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getProfitLossReport(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const filters = {
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      };
      const report = await reportService.getProfitLossReport(filters);
      res.json(report);
    } catch (error: any) {
      logger.error("Get profit/loss report error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async exportSalesReportPDF(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const filters = {
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      };
      await reportService.generateSalesReportPDF(filters, res);
    } catch (error: any) {
      logger.error("Export sales report PDF error:", error);
      if (!res.writableEnded) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async exportExpensesReportPDF(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const filters = {
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      };
      await reportService.generateExpensesReportPDF(filters, res);
    } catch (error: any) {
      logger.error("Export expenses report PDF error:", error);
      if (!res.writableEnded) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async exportProfitLossReportPDF(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const filters = {
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
      };
      await reportService.generateProfitLossReportPDF(filters, res);
    } catch (error: any) {
      logger.error("Export profit/loss report PDF error:", error);
      if (!res.writableEnded) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }
}

export default new ReportController();

