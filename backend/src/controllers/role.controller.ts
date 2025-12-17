import { Request, Response } from "express";
import roleService from "../services/role.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class RoleController {
  async getRoles(req: AuthRequest, res: Response) {
    try {
      const roles = await roleService.getRoles();
      return res.status(200).json({
        message: "Roles retrieved successfully",
        response: {
          data: roles,
        },
        error: null,
      });
    } catch (error: any) {
      logger.error("Get roles error:", error);
      return res.status(500).json({
        message: "Internal server error",
        response: null,
        error: "Internal server error",
      });
    }
  }

  async createRole(req: AuthRequest, res: Response) {
    try {
      // Only admin and superadmin can create roles
      if (req.user?.role !== "admin" && req.user?.role !== "superadmin") {
        return res.status(403).json({
          message: "Only admin and superadmin can create roles",
          response: null,
          error: "Only admin and superadmin can create roles",
        });
      }

      const role = await roleService.createRole(req.body);
      logger.info(`Role created: ${role.name} by ${req.user?.username}`);
      return res.status(201).json({
        message: "Role created successfully",
        response: {
          data: role,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Create role error:", error);
      
      // Handle validation errors from service
      if (
        error instanceof Error &&
        (error.message.includes("already exists") ||
          error.message.includes("reserved") ||
          error.message.includes("must be lowercase") ||
          error.message.includes("Role name") ||
          error.message.includes("Role label"))
      ) {
        // Map service errors to field-specific errors
        const fieldErrors: Record<string, string[]> = {};
        if (error.message.includes("name")) {
          fieldErrors.name = [errorMessage];
        } else if (error.message.includes("label")) {
          fieldErrors.label = [errorMessage];
        } else {
          fieldErrors.name = [errorMessage];
        }
        
        return res.status(400).json({
          message: "Validation failed",
          response: null,
          error: fieldErrors,
        });
      }
      
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async updateRole(req: AuthRequest, res: Response) {
    try {
      // Only admin and superadmin can update roles
      if (req.user?.role !== "admin" && req.user?.role !== "superadmin") {
        return res.status(403).json({
          message: "Only admin and superadmin can update roles",
          response: null,
          error: "Only admin and superadmin can update roles",
        });
      }

      const role = await roleService.updateRole(req.params.id, req.body);
      logger.info(`Role updated: ${req.params.id} by ${req.user?.username}`);
      return res.status(200).json({
        message: "Role updated successfully",
        response: {
          data: role,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Update role error:", error);
      if (error instanceof Error && error.message === "Role not found") {
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

  async deleteRole(req: AuthRequest, res: Response) {
    try {
      // Only admin and superadmin can delete roles
      if (req.user?.role !== "admin" && req.user?.role !== "superadmin") {
        return res.status(403).json({
          message: "Only admin and superadmin can delete roles",
          response: null,
          error: "Only admin and superadmin can delete roles",
        });
      }

      await roleService.deleteRole(req.params.id);
      logger.info(`Role deleted: ${req.params.id} by ${req.user?.username}`);
      return res.status(200).json({
        message: "Role deleted successfully",
        response: {
          data: null,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Delete role error:", error);
      if (error instanceof Error && error.message === "Role not found") {
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
}

export default new RoleController();


