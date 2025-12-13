import { Request, Response } from "express";
import bankAccountService from "../services/bankAccount.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class BankAccountController {
  async getBankAccounts(req: AuthRequest, res: Response) {
    try {
      const accounts = await bankAccountService.getBankAccounts();
      res.json(accounts);
    } catch (error: any) {
      logger.error("Get bank accounts error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getBankAccount(req: AuthRequest, res: Response) {
    try {
      const account = await bankAccountService.getBankAccount(req.params.id);
      res.json(account);
    } catch (error: any) {
      logger.error("Get bank account error:", error);
      if (error.message === "Bank account not found") {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async getDefaultBankAccount(req: AuthRequest, res: Response) {
    try {
      const account = await bankAccountService.getDefaultBankAccount();
      res.json(account);
    } catch (error: any) {
      logger.error("Get default bank account error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async createBankAccount(req: AuthRequest, res: Response) {
    try {
      const account = await bankAccountService.createBankAccount(req.body);
      logger.info(`Bank account created: ${account.accountName} by ${req.user?.username}`);
      res.status(201).json(account);
    } catch (error: any) {
      logger.error("Create bank account error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async updateBankAccount(req: AuthRequest, res: Response) {
    try {
      const account = await bankAccountService.updateBankAccount(req.params.id, req.body);
      logger.info(`Bank account updated: ${account.accountName} by ${req.user?.username}`);
      res.json(account);
    } catch (error: any) {
      logger.error("Update bank account error:", error);
      if (error.message === "Bank account not found") {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async deleteBankAccount(req: AuthRequest, res: Response) {
    try {
      await bankAccountService.deleteBankAccount(req.params.id);
      logger.info(`Bank account deleted: ${req.params.id} by ${req.user?.username}`);
      res.json({ message: "Bank account deleted successfully" });
    } catch (error: any) {
      logger.error("Delete bank account error:", error);
      if (error.message === "Bank account not found") {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }
}

export default new BankAccountController();


