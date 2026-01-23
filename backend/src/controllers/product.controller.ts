import { Request, Response } from "express";
import productService from "../services/product.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class ProductController {
  async getProducts(req: AuthRequest, res: Response) {
    try {
      const { search, category, lowStock, page, pageSize } = req.query;
      const filters = {
        search: search as string | undefined,
        category: category as string | undefined,
        lowStock: lowStock === "true",
        page: page ? parseInt(page as string) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string) : undefined,
      };
      const result = await productService.getProducts(filters);
      return res.status(200).json({
        message: "Products retrieved successfully",
        response: result,
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get products error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async getProduct(req: AuthRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const product = await productService.getProduct(id);
      return res.status(200).json({
        message: "Product retrieved successfully",
        response: {
          data: product,
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get product error:", error);
      if (error instanceof Error && error.message === "Product not found") {
        return res.status(404).json({
          message: "Product not found",
          response: null,
          error: "Product not found",
        });
      }
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async createProduct(req: AuthRequest, res: Response) {
    try {
      const product = await productService.createProduct(req.body);
      logger.info(`Product created: ${product.name} by ${req.user?.username}`);
      return res.status(201).json({
        message: "Product created successfully",
        response: {
          data: product,
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Create product error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async updateProduct(req: AuthRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const product = await productService.updateProduct(id, req.body);
      logger.info(`Product updated: ${product.name} by ${req.user?.username}`);
      return res.status(200).json({
        message: "Product updated successfully",
        response: {
          data: product,
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Update product error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async deleteProduct(req: AuthRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await productService.deleteProduct(id);
      logger.info(`Product deleted: ${id} by ${req.user?.username}`);
      return res.status(200).json({
        message: "Product deleted successfully",
        response: {
          data: null,
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Delete product error:", error);
      
      // Check if it's a validation error (product not found or cannot delete)
      if (error instanceof Error && (
        error.message.includes("Cannot delete product") ||
        error.message === "Product not found"
      )) {
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

  async getLowStockProducts(req: AuthRequest, res: Response) {
    try {
      const products = await productService.getLowStockProducts();
      return res.status(200).json({
        message: "Low stock products retrieved successfully",
        response: {
          data: products,
        },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get low stock products error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }
}

export default new ProductController();


