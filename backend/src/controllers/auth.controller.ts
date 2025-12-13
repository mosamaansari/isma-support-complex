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
      logger.error("SuperAdmin login error:", error);
      const statusCode = error.message === "Invalid superadmin credentials" ? 401 : 500;
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
}

export default new AuthController();


