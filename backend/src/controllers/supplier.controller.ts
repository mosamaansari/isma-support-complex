import { Response } from "express";
import supplierService from "../services/supplier.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class SupplierController {
  async getSuppliers(req: AuthRequest, res: Response) {
    try {
      const { search } = req.query;
      const suppliers = await supplierService.getSuppliers(search as string | undefined);
      return res.status(200).json({
        message: "Suppliers retrieved successfully",
        response: {
          data: suppliers,
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get suppliers error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }
}

export default new SupplierController();










