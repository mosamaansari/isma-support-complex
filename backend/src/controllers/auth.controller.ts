import { Request, Response } from "express";
import authService from "../services/auth.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class AuthController {
  async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;
      const result = await authService.login(username, password);
      res.json(result);
    } catch (error: any) {
      logger.error("Login error:", error);
      const statusCode = error.message === "Invalid credentials" ? 401 : 500;
      res.status(statusCode).json({
        error: error.message || "Internal server error",
      });
    }
  }

  async superAdminLogin(req: Request, res: Response) {
    try {
      const { username, password } = req.body;
      const result = await authService.superAdminLogin(username, password);
      res.json(result);
    } catch (error: any) {
      logger.error("Admin login error:", error);
      const statusCode = error.message.includes("Invalid admin credentials") || error.message.includes("Invalid superadmin credentials") ? 401 : 500;
      res.status(statusCode).json({
        error: error.message || "Internal server error",
      });
    }
  }

  async logout(req: Request, res: Response) {
    try {
      const token = req.headers.authorization?.replace("Bearer ", "") || "";
      await authService.logout(token);
      res.json({ message: "Logged out successfully" });
    } catch (error: any) {
      logger.error("Logout error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async forgotPassword(req: Request, res: Response) {
    try {
      const { email, userType } = req.body;
      const result = await authService.forgotPassword(email, userType || "user");
      res.json(result);
    } catch (error: any) {
      logger.error("Forgot password error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword, userType } = req.body;
      const result = await authService.resetPassword(token, newPassword, userType || "user");
      res.json(result);
    } catch (error: any) {
      logger.error("Reset password error:", error);
      const statusCode = error.message.includes("Invalid") || error.message.includes("expired") ? 400 : 500;
      res.status(statusCode).json({ error: error.message || "Internal server error" });
    }
  }
}

export default new AuthController();


