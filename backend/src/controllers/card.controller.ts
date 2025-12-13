import { Request, Response } from "express";
import cardService from "../services/card.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class CardController {
  async getCards(req: AuthRequest, res: Response) {
    try {
      const cards = await cardService.getCards();
      res.json(cards);
    } catch (error: any) {
      logger.error("Get cards error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async getCard(req: AuthRequest, res: Response) {
    try {
      const card = await cardService.getCard(req.params.id);
      res.json(card);
    } catch (error: any) {
      logger.error("Get card error:", error);
      if (error.message === "Card not found") {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async getDefaultCard(req: AuthRequest, res: Response) {
    try {
      const card = await cardService.getDefaultCard();
      res.json(card);
    } catch (error: any) {
      logger.error("Get default card error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async createCard(req: AuthRequest, res: Response) {
    try {
      const card = await cardService.createCard(req.body);
      logger.info(`Card created: ${card.name} by ${req.user?.username}`);
      res.status(201).json(card);
    } catch (error: any) {
      logger.error("Create card error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async updateCard(req: AuthRequest, res: Response) {
    try {
      const card = await cardService.updateCard(req.params.id, req.body);
      logger.info(`Card updated: ${card.name} by ${req.user?.username}`);
      res.json(card);
    } catch (error: any) {
      logger.error("Update card error:", error);
      if (error.message === "Card not found") {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  async deleteCard(req: AuthRequest, res: Response) {
    try {
      await cardService.deleteCard(req.params.id);
      logger.info(`Card deleted: ${req.params.id} by ${req.user?.username}`);
      res.json({ message: "Card deleted successfully" });
    } catch (error: any) {
      logger.error("Delete card error:", error);
      if (error.message === "Card not found") {
        res.status(404).json({ error: error.message });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  }
}

export default new CardController();


