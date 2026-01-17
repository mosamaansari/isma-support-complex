import { Response } from "express";
import openingBalanceService from "../services/openingBalance.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";
import balanceManagementService from "../services/balanceManagement.service";

class OpeningBalanceController {
  async getOpeningBalance(req: AuthRequest, res: Response) {
    try {
      const { date, storedOnly } = req.query;
      if (!date || typeof date !== "string") {
        return res.status(400).json({ error: "Date is required" });
      }
      // For reports: return only the stored values from DailyOpeningBalance table for this date.
      // When storedOnly=true, returns null if no record exists (no fallback to previous day closing).
      if (storedOnly === "true" || (typeof storedOnly === "boolean" && storedOnly)) {
        const stored = await openingBalanceService.getStoredOpeningBalanceForDate(date);
        return res.json(stored);
      }
      const openingBalance = await openingBalanceService.getOpeningBalance(date);
      res.json(openingBalance);
    } catch (error: any) {
      logger.error("Get opening balance error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getOpeningBalances(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate } = req.query;
      const openingBalances = await openingBalanceService.getOpeningBalances(
        startDate as string | undefined,
        endDate as string | undefined
      );
      res.json(openingBalances);
    } catch (error: any) {
      logger.error("Get opening balances error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async createOpeningBalance(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const openingBalance = await openingBalanceService.createOpeningBalance(
        req.body,
        {
          id: req.user.id,
          username: req.user.username,
          name: req.user.name,
          userType: req.user.userType,
        }
      );
      logger.info(`Opening balance created: ${openingBalance.id} by ${req.user.username}`);
      res.status(201).json(openingBalance);
    } catch (error: any) {
      logger.error("Create opening balance error:", error);
      if (error.message.includes("already exists")) {
        res.status(400).json({ error: error.message });
      } else if (error.message.includes("not found")) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message || "Internal server error" });
      }
    }
  }

  async updateOpeningBalance(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const openingBalance = await openingBalanceService.updateOpeningBalance(
        id,
        req.body,
        req.user ? {
          id: req.user.id,
          userType: req.user.userType,
        } : undefined
      );
      logger.info(`Opening balance updated: ${id} by ${req.user?.username}`);
      res.json(openingBalance);
    } catch (error: any) {
      logger.error("Update opening balance error:", error);
      if (error.message.includes("not found")) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message || "Internal server error" });
      }
    }
  }

  async deleteOpeningBalance(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      await openingBalanceService.deleteOpeningBalance(id);
      logger.info(`Opening balance deleted: ${id} by ${req.user?.username}`);
      res.json({ message: "Opening balance deleted successfully" });
    } catch (error: any) {
      logger.error("Delete opening balance error:", error);
      if (error.message.includes("not found")) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async addToOpeningBalance(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const { date, amount, type, bankAccountId, description } = req.body;

      // Get user name
      let userName = req.user.name || req.user.username || "Unknown User";

      // Use balanceManagementService.addToOpeningBalance which handles creating opening balance if it doesn't exist
      const result = await balanceManagementService.addToOpeningBalance(
        new Date(date),
        Number(amount),
        type,
        {
          description: description || "Add Opening Balance",
          userId: req.user.id,
          userName: userName,
          bankAccountId: type === "bank" ? bankAccountId : undefined,
        }
      );

      logger.info(`Opening balance addition: ${type} ${amount} added on ${date} by ${userName}`);
      
      // Return the updated opening balance for the date
      const openingBalance = await openingBalanceService.getOpeningBalance(date);
      
      res.json({
        message: "Opening balance added successfully",
        result: result,
        openingBalance: openingBalance,
      });
    } catch (error: any) {
      logger.error("Add to opening balance error:", error);
      if (error.message.includes("required")) {
        res.status(400).json({ error: error.message });
      } else if (error.message.includes("Insufficient")) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message || "Internal server error" });
      }
    }
  }
}

export default new OpeningBalanceController();

