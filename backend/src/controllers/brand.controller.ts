import { Request, Response } from "express";
import brandService from "../services/brand.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class BrandController {
  async getBrands(req: AuthRequest, res: Response) {
    try {
      const brands = await brandService.getBrands();
      return res.status(200).json({
        message: "Brands retrieved successfully",
        response: {
          data: brands,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get brands error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async getBrand(req: AuthRequest, res: Response) {
    try {
      const brand = await brandService.getBrand(req.params.id);
      return res.status(200).json({
        message: "Brand retrieved successfully",
        response: {
          data: brand,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get brand error:", error);
      if (error instanceof Error && error.message === "Brand not found") {
        return res.status(404).json({
          message: "Brand not found",
          response: null,
          error: "Brand not found",
        });
      }
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async createBrand(req: AuthRequest, res: Response) {
    try {
      const brand = await brandService.createBrand(req.body);
      logger.info(`Brand created: ${brand.name} by ${req.user?.username}`);
      return res.status(201).json({
        message: "Brand created successfully",
        response: {
          data: brand,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Create brand error:", error);
      if (error instanceof Error && error.message === "Brand already exists") {
        return res.status(400).json({
          message: errorMessage,
          response: null,
          error: errorMessage,
        });
      }
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async updateBrand(req: AuthRequest, res: Response) {
    try {
      const brand = await brandService.updateBrand(req.params.id, req.body);
      logger.info(`Brand updated: ${brand.name} by ${req.user?.username}`);
      return res.status(200).json({
        message: "Brand updated successfully",
        response: {
          data: brand,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Update brand error:", error);
      if (
        error instanceof Error &&
        (error.message === "Brand not found" ||
          error.message === "Brand name already exists")
      ) {
        return res.status(400).json({
          message: errorMessage,
          response: null,
          error: errorMessage,
        });
      }
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async deleteBrand(req: AuthRequest, res: Response) {
    try {
      await brandService.deleteBrand(req.params.id);
      logger.info(`Brand deleted: ${req.params.id} by ${req.user?.username}`);
      return res.status(200).json({
        message: "Brand deleted successfully",
        response: {
          data: null,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Delete brand error:", error);
      if (
        error instanceof Error &&
        (error.message === "Brand not found" ||
          error.message.includes("Cannot delete brand"))
      ) {
        return res.status(400).json({
          message: errorMessage,
          response: null,
          error: errorMessage,
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

export default new BrandController();








