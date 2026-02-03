import express, { Router } from "express";
import cardController from "../controllers/card.controller";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { bodyValidator, paramsValidator } from "../middleware/joiValidator";
import { createCardSchema, updateCardSchema } from "../validators/card.validator";
import { PERMISSIONS } from "../utils/permissions";
import Joi from "joi";

const router = Router();

// Get all cards
router.get("/", authenticate, requirePermission(PERMISSIONS.CARDS_VIEW), cardController.getCards.bind(cardController));

// Get default card
router.get("/default", authenticate, requirePermission(PERMISSIONS.CARDS_VIEW), cardController.getDefaultCard.bind(cardController));

// Get single card
router.get(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.CARDS_VIEW),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Card ID is required",
        "any.required": "Card ID is required",
      }),
    })
  ),
  cardController.getCard.bind(cardController)
);

// Create card
router.post(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.CARDS_CREATE),
  bodyValidator(createCardSchema),
  cardController.createCard.bind(cardController)
);

// Update card
router.put(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.CARDS_UPDATE),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Card ID is required",
        "any.required": "Card ID is required",
      }),
    })
  ),
  bodyValidator(updateCardSchema),
  cardController.updateCard.bind(cardController)
);

// Delete card
router.delete(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.CARDS_DELETE),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Card ID is required",
        "any.required": "Card ID is required",
      }),
    })
  ),
  cardController.deleteCard.bind(cardController)
);

export default router;
