import { Request, Response } from "express";
import settingsService from "../services/settings.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class SettingsController {
  async getSettings(req: AuthRequest, res: Response) {
    try {
      const settings = await settingsService.getSettings();
      return res.status(200).json({
        message: "Settings retrieved successfully",
        response: {
          data: settings,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get settings error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async updateSettings(req: AuthRequest, res: Response) {
    try {
      const settings = await settingsService.updateSettings(req.body.data);
      logger.info(`Settings updated by ${req.user?.username}`);
      return res.status(200).json({
        message: "Settings updated successfully",
        response: {
          data: settings,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Update settings error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }
}

export default new SettingsController();


