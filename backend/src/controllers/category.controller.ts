import { Request, Response } from "express";
import categoryService from "../services/category.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class CategoryController {
  async getCategories(req: AuthRequest, res: Response) {
    try {
      const categories = await categoryService.getCategories();
      res.json(categories);
    } catch (error: any) {
      logger.error("Get categories error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getCategory(req: AuthRequest, res: Response) {
    try {
      const category = await categoryService.getCategory(req.params.id);
      res.json(category);
    } catch (error: any) {
      logger.error("Get category error:", error);
      if (error.message === "Category not found") {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async createCategory(req: AuthRequest, res: Response) {
    try {
      const category = await categoryService.createCategory(req.body);
      logger.info(`Category created: ${category.name} by ${req.user?.username}`);
      res.status(201).json(category);
    } catch (error: any) {
      logger.error("Create category error:", error);
      if (error.message === "Category already exists") {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async updateCategory(req: AuthRequest, res: Response) {
    try {
      const category = await categoryService.updateCategory(req.params.id, req.body);
      logger.info(`Category updated: ${category.name} by ${req.user?.username}`);
      res.json(category);
    } catch (error: any) {
      logger.error("Update category error:", error);
      if (
        error.message === "Category not found" ||
        error.message === "Category name already exists"
      ) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async deleteCategory(req: AuthRequest, res: Response) {
    try {
      await categoryService.deleteCategory(req.params.id);
      logger.info(`Category deleted: ${req.params.id} by ${req.user?.username}`);
      res.json({ message: "Category deleted successfully" });
    } catch (error: any) {
      logger.error("Delete category error:", error);
      if (
        error.message === "Category not found" ||
        error.message.includes("Cannot delete category")
      ) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }
}

export default new CategoryController();


