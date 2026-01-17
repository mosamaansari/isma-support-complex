import { Request, Response } from "express";
import purchaseService from "../services/purchase.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class PurchaseController {
  async getPurchases(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate, supplierId, page, pageSize } = req.query;
      const filters = {
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        supplierId: supplierId as string | undefined,
        page: page ? parseInt(page as string) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string) : undefined,
      };
      const result = await purchaseService.getPurchases(filters);
      return res.status(200).json({
        message: "Purchases retrieved successfully",
        response: result,
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get purchases error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async createPurchase(req: AuthRequest, res: Response) {
    try {
      const purchase = await purchaseService.createPurchase(req.body, req.user!.id, req.user?.userType);
      logger.info(`Purchase created: ${purchase.id} by ${req.user?.username}`);
      return res.status(201).json({
        message: "Purchase created successfully",
        response: {
          data: purchase,
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Create purchase error:", error);
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({
          message: error.message,
          response: null,
          error: error.message,
        });
      }
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async getPurchase(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const purchase = await purchaseService.getPurchase(id);
      return res.status(200).json({
        message: "Purchase retrieved successfully",
        response: {
          data: purchase,
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get purchase error:", error);
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({
          message: error.message,
          response: null,
          error: error.message,
        });
      }
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async updatePurchase(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const purchase = await purchaseService.updatePurchase(id, req.body, req.user!.id);
      logger.info(`Purchase updated: ${purchase.id} by ${req.user?.username}`);
      return res.status(200).json({
        message: "Purchase updated successfully",
        response: {
          data: purchase,
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Update purchase error:", error);
      if (error instanceof Error && error.message.includes("not found")) {
        return res.status(404).json({
          message: error.message,
          response: null,
          error: error.message,
        });
      }
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async cancelPurchase(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const { refundMethod, bankAccountId } = req.body;
      
      const refundData = refundMethod ? {
        refundMethod: refundMethod as "cash" | "bank_transfer",
        bankAccountId: bankAccountId,
      } : undefined;

      const purchase = await purchaseService.cancelPurchase(
        id,
        refundData,
        req.user!.id,
        req.user!.username || req.user!.name || "Unknown"
      );
      
      return res.status(200).json({
        message: "Purchase cancelled successfully",
        response: {
          data: purchase,
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Cancel purchase error:", error);
      
      if (error instanceof Error) {
        if (error.message === "Purchase not found") {
          return res.status(404).json({
            message: "Purchase not found",
            response: null,
            error: "Purchase not found",
          });
        }
        if (error.message.includes("already cancelled")) {
          return res.status(400).json({
            message: error.message,
            response: null,
            error: error.message,
          });
        }
        if (error.message.includes("7 days") || error.message.includes("within")) {
          return res.status(400).json({
            message: error.message,
            response: null,
            error: error.message,
          });
        }
        if (error.message.includes("Refund method") || error.message.includes("refund")) {
          return res.status(400).json({
            message: error.message,
            response: null,
            error: error.message,
          });
        }
      }
      
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async addPayment(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      console.log("req.body", req.body)
      const purchase = await purchaseService.addPaymentToPurchase(id, req.body, req.user!.id, req.user?.userType);
      logger.info(`Payment added to purchase: ${purchase.id} by ${req.user?.username}`);
      return res.status(200).json({
        message: "Payment added successfully",
        response: {
          data: purchase,
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Add payment error:", error);
      if (error instanceof Error) {
        if (error.message.includes("not found")) {
          return res.status(404).json({
            message: error.message,
            response: null,
            error: error.message,
          });
        }
        if (error.message.includes("exceeds")) {
          return res.status(400).json({
            message: error.message,
            response: null,
            error: error.message,
          });
        }
      }
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }
}

export default new PurchaseController();

