import { Response } from "express";
import dailyConfirmationService from "../services/dailyConfirmation.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class DailyConfirmationController {
  async checkConfirmation(req: AuthRequest, res: Response) {
    try {
      const status = await dailyConfirmationService.getConfirmationStatus();
      return res.status(200).json({
        message: "Confirmation status retrieved successfully",
        response: status,
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Check confirmation error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async confirmDaily(req: AuthRequest, res: Response) {
    try {
      if (!req.user) {
        return res.status(401).json({
          message: "Authentication required",
          response: null,
          error: "Authentication required",
        });
      }

      await dailyConfirmationService.confirmDaily({
        id: req.user.id,
        userType: req.user.userType,
      });

      return res.status(200).json({
        message: "Daily confirmation completed successfully",
        response: { confirmed: true },
        error: null,
      });
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Confirm daily error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }
}

export default new DailyConfirmationController();






