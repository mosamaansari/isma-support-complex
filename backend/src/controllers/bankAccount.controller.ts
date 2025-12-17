import { Request, Response } from "express";
import bankAccountService from "../services/bankAccount.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class BankAccountController {
  async getBankAccounts(req: AuthRequest, res: Response) {
    try {
      const accounts = await bankAccountService.getBankAccounts();
      return res.status(200).json({
        message: "Bank accounts retrieved successfully",
        response: {
          data: accounts,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get bank accounts error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async getBankAccount(req: AuthRequest, res: Response) {
    try {
      const account = await bankAccountService.getBankAccount(req.params.id);
      return res.status(200).json({
        message: "Bank account retrieved successfully",
        response: {
          data: account,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get bank account error:", error);
      if (error instanceof Error && error.message === "Bank account not found") {
        return res.status(404).json({
          message: "Bank account not found",
          response: null,
          error: "Bank account not found",
        });
      }
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async getDefaultBankAccount(req: AuthRequest, res: Response) {
    try {
      const account = await bankAccountService.getDefaultBankAccount();
      return res.status(200).json({
        message: "Default bank account retrieved successfully",
        response: {
          data: account,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get default bank account error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async createBankAccount(req: AuthRequest, res: Response) {
    try {
      const account = await bankAccountService.createBankAccount(req.body);
      logger.info(`Bank account created: ${account.accountName} by ${req.user?.username}`);
      return res.status(201).json({
        message: "Bank account created successfully",
        response: {
          data: account,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Create bank account error:", error);
      
      // Handle duplicate account error
      if (errorMessage.includes("already exists") || error?.code === "P2002") {
        return res.status(409).json({
          message: "An account with this account number and bank name already exists",
          response: null,
          error: "An account with this account number and bank name already exists",
        });
      }
      
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async updateBankAccount(req: AuthRequest, res: Response) {
    try {
      const account = await bankAccountService.updateBankAccount(req.params.id, req.body);
      logger.info(`Bank account updated: ${account.accountName} by ${req.user?.username}`);
      return res.status(200).json({
        message: "Bank account updated successfully",
        response: {
          data: account,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Update bank account error:", error);
      
      if (error instanceof Error && error.message === "Bank account not found") {
        return res.status(404).json({
          message: "Bank account not found",
          response: null,
          error: "Bank account not found",
        });
      }
      
      // Handle duplicate account error
      if (errorMessage.includes("already exists") || error?.code === "P2002") {
        return res.status(409).json({
          message: "An account with this account number and bank name already exists",
          response: null,
          error: "An account with this account number and bank name already exists",
        });
      }
      
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async deleteBankAccount(req: AuthRequest, res: Response) {
    try {
      await bankAccountService.deleteBankAccount(req.params.id);
      logger.info(`Bank account deleted: ${req.params.id} by ${req.user?.username}`);
      return res.status(200).json({
        message: "Bank account deleted successfully",
        response: {
          data: null,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Delete bank account error:", error);
      if (error instanceof Error && error.message === "Bank account not found") {
        return res.status(404).json({
          message: "Bank account not found",
          response: null,
          error: "Bank account not found",
        });
      }
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }
}

export default new BankAccountController();


