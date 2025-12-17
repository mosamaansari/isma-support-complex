import { Request, Response } from "express";
import userService from "../services/user.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class UserController {
  async getUsers(req: AuthRequest, res: Response) {
    try {
      const { page, pageSize } = req.query;
      const filters = {
        page: page ? parseInt(page as string) : undefined,
        pageSize: pageSize ? parseInt(pageSize as string) : undefined,
      };
      const result = await userService.getUsers(filters);
      return res.status(200).json({
        message: "Users retrieved successfully",
        response: result,
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get users error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async getUser(req: AuthRequest, res: Response) {
    try {
      const user = await userService.getUser(req.params.id);
      return res.status(200).json({
        message: "User retrieved successfully",
        response: {
          data: user,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get user error:", error);
      if (error instanceof Error && error.message === "User not found") {
        return res.status(404).json({
          message: "User not found",
          response: null,
          error: "User not found",
        });
      }
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async createUser(req: AuthRequest, res: Response) {
    try {
      // Only admin and superadmin can create users
      if (req.user?.role !== "admin" && req.user?.role !== "superadmin") {
        return res.status(403).json({
          message: "Only admin and superadmin can create users",
          response: null,
          error: "Only admin and superadmin can create users",
        });
      }

      // Prevent creating admin/superadmin in user table
      if (req.body.role === "superadmin" || req.body.role === "admin") {
        return res.status(400).json({
          message: "Cannot create admin or superadmin in users table",
          response: null,
          error: "Cannot create admin or superadmin in users table",
        });
      }

      const user = await userService.createUser(req.body);
      logger.info(`User created: ${user.username} by ${req.user?.username}`);
      return res.status(201).json({
        message: "User created successfully",
        response: {
          data: user,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Create user error:", error);
      if (error instanceof Error && (error.message === "Username already exists" || error.message.includes("Invalid role"))) {
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

  async updateUser(req: AuthRequest, res: Response) {
    try {
      // Only admin and superadmin can update users
      if (req.user?.role !== "admin" && req.user?.role !== "superadmin") {
        return res.status(403).json({
          message: "Not authorized to update users",
          response: null,
          error: "Not authorized to update users",
        });
      }

      // Prevent updating to admin/superadmin role
      if (req.body.role === "superadmin" || req.body.role === "admin") {
        return res.status(400).json({
          message: "Cannot set role to admin or superadmin",
          response: null,
          error: "Cannot set role to admin or superadmin",
        });
      }

      const canModify = await userService.canUserModify(
        req.params.id,
        req.user!.id,
        req.user!.role
      );

      if (!canModify) {
        return res.status(403).json({
          message: "Not authorized to update this user",
          response: null,
          error: "Not authorized to update this user",
        });
      }

      const user = await userService.updateUser(req.params.id, req.body);
      logger.info(`User updated: ${user.username} by ${req.user?.username}`);
      return res.status(200).json({
        message: "User updated successfully",
        response: {
          data: user,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Update user error:", error);
      if (error instanceof Error && (error.message === "User not found" || error.message.includes("Invalid role"))) {
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

  async updateProfile(req: AuthRequest, res: Response) {
    try {
      const userType = req.user!.userType || "user";
      const user = await userService.updateProfile(req.user!.id, userType, req.body);
      logger.info(`Profile updated: ${user.username}`);
      return res.status(200).json({
        message: "Profile updated successfully",
        response: {
          data: user,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Update profile error:", error);
      if (error instanceof Error && error.message === "User not found") {
        return res.status(404).json({
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

  async updatePassword(req: AuthRequest, res: Response) {
    try {
      const userType = req.user!.userType || "user";
      await userService.updatePassword(req.user!.id, userType, req.body);
      logger.info(`Password updated for user: ${req.user!.username}`);
      return res.status(200).json({
        message: "Password updated successfully",
        response: {
          data: null,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Update password error:", error);
      if (error instanceof Error) {
      if (
        error.message === "User not found" ||
          error.message === "Current password is required" ||
        error.message === "Current password is incorrect"
      ) {
        const statusCode = error.message.includes("password") ? 401 : 404;
          return res.status(statusCode).json({
            message: errorMessage,
            response: null,
            error: errorMessage,
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

  async deleteUser(req: AuthRequest, res: Response) {
    try {
      const canModify = await userService.canUserModify(
        req.params.id,
        req.user!.id,
        req.user!.role
      );

      if (!canModify) {
        return res.status(403).json({
          message: "Not authorized to delete this user",
          response: null,
          error: "Not authorized to delete this user",
        });
      }

      await userService.deleteUser(req.params.id);
      logger.info(`User deleted: ${req.params.id} by ${req.user?.username}`);
      return res.status(200).json({
        message: "User deleted successfully",
        response: {
          data: null,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Delete user error:", error);
      if (error instanceof Error && error.message === "User not found") {
        return res.status(404).json({
          message: "User not found",
          response: null,
          error: "User not found",
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

export default new UserController();


