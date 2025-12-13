import { Request, Response } from "express";
import purchaseService from "../services/purchase.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class PurchaseController {
  async getPurchases(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate, supplierId } = req.query;
      const filters = {
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        supplierId: supplierId as string | undefined,
      };
      const purchases = await purchaseService.getPurchases(filters);
      res.json(purchases);
    } catch (error: any) {
      logger.error("Get purchases error:", error);
      const errorMessage = error?.message || "Internal server error";
      res.status(500).json({ 
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined
      });
    }
  }

  async createPurchase(req: AuthRequest, res: Response) {
    try {
      const purchase = await purchaseService.createPurchase(req.body, req.user!.id);
      logger.info(`Purchase created: ${purchase.id} by ${req.user?.username}`);
      res.status(201).json(purchase);
    } catch (error: any) {
      logger.error("Create purchase error:", error);
      if (error.message.includes("not found")) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async getPurchase(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const purchase = await purchaseService.getPurchase(id);
      res.json(purchase);
    } catch (error: any) {
      logger.error("Get purchase error:", error);
      if (error.message.includes("not found")) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async updatePurchase(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const purchase = await purchaseService.updatePurchase(id, req.body, req.user!.id);
      logger.info(`Purchase updated: ${purchase.id} by ${req.user?.username}`);
      res.json(purchase);
    } catch (error: any) {
      logger.error("Update purchase error:", error);
      if (error.message.includes("not found")) {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async addPayment(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const purchase = await purchaseService.addPaymentToPurchase(id, req.body, req.user!.id);
      logger.info(`Payment added to purchase: ${purchase.id} by ${req.user?.username}`);
      res.json(purchase);
    } catch (error: any) {
      logger.error("Add payment error:", error);
      if (error.message.includes("not found")) {
        res.status(404).json({ error: error.message });
      } else if (error.message.includes("exceeds")) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }
}

export default new PurchaseController();

