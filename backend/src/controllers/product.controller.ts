import { Request, Response } from "express";
import productService from "../services/product.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class ProductController {
  async getProducts(req: AuthRequest, res: Response) {
    try {
      const { search, category, lowStock } = req.query;
      const filters = {
        search: search as string | undefined,
        category: category as string | undefined,
        lowStock: lowStock === "true",
      };
      const products = await productService.getProducts(filters);
      res.json(products);
    } catch (error: any) {
      logger.error("Get products error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getProduct(req: AuthRequest, res: Response) {
    try {
      const product = await productService.getProduct(req.params.id);
      res.json(product);
    } catch (error: any) {
      logger.error("Get product error:", error);
      if (error.message === "Product not found") {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async createProduct(req: AuthRequest, res: Response) {
    try {
      const product = await productService.createProduct(req.body);
      logger.info(`Product created: ${product.name} by ${req.user?.username}`);
      res.status(201).json(product);
    } catch (error: any) {
      logger.error("Create product error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async updateProduct(req: AuthRequest, res: Response) {
    try {
      const product = await productService.updateProduct(req.params.id, req.body);
      logger.info(`Product updated: ${product.name} by ${req.user?.username}`);
      res.json(product);
    } catch (error: any) {
      logger.error("Update product error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async deleteProduct(req: AuthRequest, res: Response) {
    try {
      await productService.deleteProduct(req.params.id);
      logger.info(`Product deleted: ${req.params.id} by ${req.user?.username}`);
      res.json({ message: "Product deleted successfully" });
    } catch (error: any) {
      logger.error("Delete product error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getLowStockProducts(req: AuthRequest, res: Response) {
    try {
      const products = await productService.getLowStockProducts();
      res.json(products);
    } catch (error: any) {
      logger.error("Get low stock products error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

export default new ProductController();


