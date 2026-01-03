import { Response } from "express";
import dashboardService from "../services/dashboard.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class DashboardController {
  async getDashboardStats(req: AuthRequest, res: Response) {
    try {
      const stats = await dashboardService.getDashboardStats();
      res.json(stats);
    } catch (error: any) {
      logger.error("Get dashboard stats error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

export default new DashboardController();














