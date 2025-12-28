import { Response } from "express";
import dailyClosingBalanceService from "../services/dailyClosingBalance.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class DailyClosingBalanceController {
  async getClosingBalance(req: AuthRequest, res: Response) {
    try {
      const { date } = req.query;
      if (!date || typeof date !== "string") {
        return res.status(400).json({ error: "Date is required" });
      }
      const closingBalance = await dailyClosingBalanceService.getClosingBalance(date);
      res.json(closingBalance);
    } catch (error: any) {
      logger.error("Get closing balance error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }

  async getPreviousDayClosingBalance(req: AuthRequest, res: Response) {
    try {
      const { date } = req.query;
      if (!date || typeof date !== "string") {
        return res.status(400).json({ error: "Date is required" });
      }
      const previousClosing = await dailyClosingBalanceService.getPreviousDayClosingBalance(date);
      res.json(previousClosing);
    } catch (error: any) {
      logger.error("Get previous day closing balance error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }

  async getClosingBalances(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate || typeof startDate !== "string" || typeof endDate !== "string") {
        return res.status(400).json({ error: "Start date and end date are required" });
      }
      const closingBalances = await dailyClosingBalanceService.getClosingBalances(startDate, endDate);
      res.json(closingBalances);
    } catch (error: any) {
      logger.error("Get closing balances error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }

  async calculateClosingBalance(req: AuthRequest, res: Response) {
    try {
      const { date } = req.body;
      if (!date || typeof date !== "string") {
        return res.status(400).json({ error: "Date is required" });
      }
      const dateObj = new Date(date);
      const closingBalance = await dailyClosingBalanceService.calculateAndStoreClosingBalance(dateObj);
      res.json(closingBalance);
    } catch (error: any) {
      logger.error("Calculate closing balance error:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }
}

export default new DailyClosingBalanceController();




