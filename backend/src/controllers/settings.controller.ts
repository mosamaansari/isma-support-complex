import { Request, Response } from "express";
import settingsService from "../services/settings.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class SettingsController {
  async getSettings(req: AuthRequest, res: Response) {
    try {
      const settings = await settingsService.getSettings();
      res.json(settings);
    } catch (error: any) {
      logger.error("Get settings error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async updateSettings(req: AuthRequest, res: Response) {
    try {
      const settings = await settingsService.updateSettings(req.body);
      logger.info(`Settings updated by ${req.user?.username}`);
      res.json(settings);
    } catch (error: any) {
      logger.error("Update settings error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

export default new SettingsController();


