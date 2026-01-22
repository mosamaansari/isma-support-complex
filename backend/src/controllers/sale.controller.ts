import { Response } from "express";
import saleService from "../services/sale.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class SaleController {
  async getSales(req: AuthRequest, res: Response) {
    try {
      const { startDate, endDate, status, search, page, pageSize } = req.query;
      const filters = {
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        status: status as string | undefined,
        search: search as string | undefined,
        page: page ? parseInt(page as string) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string) : undefined,
      };
      const result = await saleService.getSales(filters);
      return res.status(200).json({
        message: "Sales retrieved successfully",
        response: result,
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get sales error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async getSale(req: AuthRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const sale = await saleService.getSale(id);
      return res.status(200).json({
        message: "Sale retrieved successfully",
        response: {
          data: sale,
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get sale error:", error);
      if (error instanceof Error && error.message === "Sale not found") {
        return res.status(404).json({
          message: "Sale not found",
          response: null,
          error: "Sale not found",
        });
      }
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async getSaleByBillNumber(req: AuthRequest, res: Response) {
    try {
      const billNumber = Array.isArray(req.params.billNumber) ? req.params.billNumber[0] : req.params.billNumber;
      const sale = await saleService.getSaleByBillNumber(billNumber);
      return res.status(200).json({
        message: "Sale retrieved successfully",
        response: {
          data: sale,
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get sale by bill number error:", error);
      if (error instanceof Error && error.message === "Sale not found") {
        return res.status(404).json({
          message: "Sale not found",
          response: null,
          error: "Sale not found",
        });
      }
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async createSale(req: AuthRequest, res: Response) {
    try {
      console.log(req.body) 
      const sale = await saleService.createSale(
        req.body,
        req.user!.id,
        req.user!.userType
      );
      return res.status(201).json({
        message: "Sale created successfully",
        response: {
          data: sale,
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Create sale error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async addPaymentToSale(req: AuthRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const payment = req.body;
      const sale = await saleService.addPaymentToSale(
        id,
        payment,
        req.user!.id,
        req.user!.userType
      );
      return res.status(200).json({
        message: "Payment added successfully",
        response: {
          data: sale,
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Add payment to sale error:", error);
      
      if (error instanceof Error) {
        if (error.message === "Sale not found") {
          return res.status(404).json({
            message: "Sale not found",
            response: null,
            error: "Sale not found",
          });
        }
        if (error.message === "Cannot add payment to cancelled sale") {
          return res.status(400).json({
            message: error.message,
            response: null,
            error: error.message,
          });
        }
        if (error.message === "Payment amount exceeds remaining balance") {
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

  async cancelSale(req: AuthRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const { refundMethod, bankAccountId } = req.body;
      
      const refundData = refundMethod ? {
        refundMethod: refundMethod as "cash" | "bank_transfer",
        bankAccountId: bankAccountId,
      } : undefined;

      const sale = await saleService.cancelSale(
        id,
        refundData,
        req.user!.id,
        req.user!.username || req.user!.name || "Unknown"
      );
      
      return res.status(200).json({
        message: "Sale cancelled successfully",
        response: {
          data: sale,
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Cancel sale error:", error);
      
      if (error instanceof Error) {
        if (error.message === "Sale not found") {
          return res.status(404).json({
            message: "Sale not found",
            response: null,
            error: "Sale not found",
          });
        }
        if (error.message === "Sale already cancelled" || error.message.includes("already cancelled")) {
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
}

export default new SaleController();
