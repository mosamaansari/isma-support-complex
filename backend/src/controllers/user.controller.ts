import { Request, Response } from "express";
import userService from "../services/user.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class UserController {
  async getUsers(req: AuthRequest, res: Response) {
    try {
      const users = await userService.getUsers();
      res.json(users);
    } catch (error: any) {
      logger.error("Get users error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getUser(req: AuthRequest, res: Response) {
    try {
      const user = await userService.getUser(req.params.id);
      res.json(user);
    } catch (error: any) {
      logger.error("Get user error:", error);
      if (error.message === "User not found") {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async createUser(req: AuthRequest, res: Response) {
    try {
      // Only admin and superadmin can create users
      if (req.user?.role !== "admin" && req.user?.role !== "superadmin") {
        return res.status(403).json({ error: "Only admin and superadmin can create users" });
      }

      // Prevent creating admin/superadmin in user table
      if (req.body.role === "superadmin" || req.body.role === "admin") {
        return res.status(400).json({ error: "Cannot create admin or superadmin in users table" });
      }

      const user = await userService.createUser(req.body);
      logger.info(`User created: ${user.username} by ${req.user?.username}`);
      res.status(201).json(user);
    } catch (error: any) {
      logger.error("Create user error:", error);
      if (error.message === "Username already exists" || error.message.includes("Invalid role")) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async updateUser(req: AuthRequest, res: Response) {
    try {
      // Only admin and superadmin can update users
      if (req.user?.role !== "admin" && req.user?.role !== "superadmin") {
        return res.status(403).json({ error: "Not authorized to update users" });
      }

      // Prevent updating to admin/superadmin role
      if (req.body.role === "superadmin" || req.body.role === "admin") {
        return res.status(400).json({ error: "Cannot set role to admin or superadmin" });
      }

      const canModify = await userService.canUserModify(
        req.params.id,
        req.user!.id,
        req.user!.role
      );

      if (!canModify) {
        return res.status(403).json({ error: "Not authorized to update this user" });
      }

      const user = await userService.updateUser(req.params.id, req.body);
      logger.info(`User updated: ${user.username} by ${req.user?.username}`);
      res.json(user);
    } catch (error: any) {
      logger.error("Update user error:", error);
      if (error.message === "User not found" || error.message.includes("Invalid role")) {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async updateProfile(req: AuthRequest, res: Response) {
    try {
      const user = await userService.updateProfile(req.user!.id, req.body);
      logger.info(`Profile updated: ${user.username}`);
      res.json(user);
    } catch (error: any) {
      logger.error("Update profile error:", error);
      if (
        error.message === "User not found" ||
        error.message === "Current password is required to change password" ||
        error.message === "Current password is incorrect"
      ) {
        const statusCode = error.message.includes("password") ? 401 : 404;
        res.status(statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
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
        return res.status(403).json({ error: "Not authorized to delete this user" });
      }

      await userService.deleteUser(req.params.id);
      logger.info(`User deleted: ${req.params.id} by ${req.user?.username}`);
      res.json({ message: "User deleted successfully" });
    } catch (error: any) {
      logger.error("Delete user error:", error);
      if (error.message === "User not found") {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }
}

export default new UserController();


