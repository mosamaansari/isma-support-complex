import { Request, Response } from "express";
import saleService from "../services/sale.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class SaleController {
  async getSales(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate, status, search } = req.query;
      const filters = {
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        status: status as string | undefined,
        search: search as string | undefined,
      };
      const sales = await saleService.getSales(filters);
      res.json(sales);
    } catch (error: any) {
      logger.error("Get sales error:", error);
      const errorMessage = error?.message || "Internal server error";
      res.status(500).json({ 
        error: "Internal server error",
        details: process.env.NODE_ENV === "development" ? errorMessage : undefined
      });
    }
  }

  async getSale(req: AuthRequest, res: Response) {
    try {
      const sale = await saleService.getSale(req.params.id);
      res.json(sale);
    } catch (error: any) {
      logger.error("Get sale error:", error);
      if (error.message === "Sale not found") {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async getSaleByBillNumber(req: AuthRequest, res: Response) {
    try {
      const sale = await saleService.getSaleByBillNumber(req.params.billNumber);
      res.json(sale);
    } catch (error: any) {
      logger.error("Get sale by bill number error:", error);
      if (error.message === "Sale not found") {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async createSale(req: AuthRequest, res: Response) {
    try {
      const sale = await saleService.createSale(req.body, req.user!.id);
      logger.info(`Sale created: ${sale.billNumber} by ${req.user?.username}`);
      res.status(201).json(sale);
    } catch (error: any) {
      logger.error("Create sale error:", error);
      if (error.message.includes("not found") || error.message.includes("Insufficient stock")) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async cancelSale(req: AuthRequest, res: Response) {
    try {
      const sale = await saleService.cancelSale(req.params.id);
      logger.info(`Sale cancelled: ${sale.billNumber} by ${req.user?.username}`);
      res.json(sale);
    } catch (error: any) {
      logger.error("Cancel sale error:", error);
      if (error.message === "Sale not found" || error.message === "Sale already cancelled") {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async addPaymentToSale(req: AuthRequest, res: Response) {
    try {
      const sale = await saleService.addPaymentToSale(req.params.id, req.body);
      logger.info(`Payment added to sale: ${sale.billNumber} by ${req.user?.username}`);
      res.json(sale);
    } catch (error: any) {
      logger.error("Add payment to sale error:", error);
      if (error.message === "Sale not found" || error.message.includes("exceeds") || error.message.includes("cancelled")) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }
}

export default new SaleController();

