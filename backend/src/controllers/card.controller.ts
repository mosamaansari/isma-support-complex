import { Request, Response } from "express";
import cardService from "../services/card.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class CardController {
  async getCards(req: AuthRequest, res: Response) {
    try {
      const cards = await cardService.getCards();
      return res.status(200).json({
        message: "Cards retrieved successfully",
        response: {
          data: cards,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get cards error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async getCard(req: AuthRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const card = await cardService.getCard(id);
      return res.status(200).json({
        message: "Card retrieved successfully",
        response: {
          data: card,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get card error:", error);
      if (error instanceof Error && error.message === "Card not found") {
        return res.status(404).json({
          message: "Card not found",
          response: null,
          error: "Card not found",
        });
      }
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async getDefaultCard(req: AuthRequest, res: Response) {
    try {
      const card = await cardService.getDefaultCard();
      return res.status(200).json({
        message: "Default card retrieved successfully",
        response: {
          data: card,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Get default card error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async createCard(req: AuthRequest, res: Response) {
    try {
      const card = await cardService.createCard(req.body);
      logger.info(`Card created: ${card.name} by ${req.user?.username}`);
      return res.status(201).json({
        message: "Card created successfully",
        response: {
          data: card,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Create card error:", error);
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async updateCard(req: AuthRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const card = await cardService.updateCard(id, req.body);
      logger.info(`Card updated: ${card.name} by ${req.user?.username}`);
      return res.status(200).json({
        message: "Card updated successfully",
        response: {
          data: card,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Update card error:", error);
      if (error instanceof Error && error.message === "Card not found") {
        return res.status(404).json({
          message: "Card not found",
          response: null,
          error: "Card not found",
        });
      }
      return res.status(500).json({
        message: errorMessage,
        response: null,
        error: errorMessage,
      });
    }
  }

  async deleteCard(req: AuthRequest, res: Response) {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      await cardService.deleteCard(id);
      logger.info(`Card deleted: ${id} by ${req.user?.username}`);
      return res.status(200).json({
        message: "Card deleted successfully",
        response: {
          data: null,
        },
        error: null,
      });
    } catch (error: any) {
      const errorMessage =
        error instanceof Error ? error.message : "An unexpected error occurred";
      logger.error("Delete card error:", error);
      if (error instanceof Error && error.message === "Card not found") {
        return res.status(404).json({
          message: "Card not found",
          response: null,
          error: "Card not found",
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

export default new CardController();


