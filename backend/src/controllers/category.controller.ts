import { Request, Response } from "express";
import categoryService from "../services/category.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class CategoryController {
  async getCategories(req: AuthRequest, res: Response) {
    try {
      const categories = await categoryService.getCategories();
      return res.status(200).json({
        message: "Categories retrieved successfully",
        response: {
          data: categories,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get categories error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async getCategory(req: AuthRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const category = await categoryService.getCategory(id);
      return res.status(200).json({
        message: "Category retrieved successfully",
        response: {
          data: category,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get category error:", error);
      if (error instanceof Error && error.message === "Category not found") {
        return res.status(404).json({
          message: "Category not found",
          response: null,
          error: "Category not found",
        });
      }
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async createCategory(req: AuthRequest, res: Response) {
    try {
      const category = await categoryService.createCategory(req.body);
      logger.info(`Category created: ${category.name} by ${req.user?.username}`);
      return res.status(201).json({
        message: "Category created successfully",
        response: {
          data: category,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Create category error:", error);
      if (error instanceof Error && error.message === "Category already exists") {
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

  async updateCategory(req: AuthRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const category = await categoryService.updateCategory(id, req.body);
      logger.info(`Category updated: ${category.name} by ${req.user?.username}`);
      return res.status(200).json({
        message: "Category updated successfully",
        response: {
          data: category,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Update category error:", error);
      if (
        error instanceof Error &&
        (error.message === "Category not found" ||
          error.message === "Category name already exists")
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

  async deleteCategory(req: AuthRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await categoryService.deleteCategory(id);
      logger.info(`Category deleted: ${id} by ${req.user?.username}`);
      return res.status(200).json({
        message: "Category deleted successfully",
        response: {
          data: null,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Delete category error:", error);
      if (
        error instanceof Error &&
        (error.message === "Category not found" ||
          error.message.includes("Cannot delete category"))
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

export default new CategoryController();


