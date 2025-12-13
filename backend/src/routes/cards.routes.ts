import express, { Router } from "express";
import cardController from "../controllers/card.controller";
import { authenticate, authorize } from "../middleware/auth";
import { validate, validateParams } from "../middleware/validate";
import { createCardSchema, updateCardSchema } from "../validators/card.validator";
import Joi from "joi";

const router = Router();

// Get all cards
router.get("/", authenticate, cardController.getCards.bind(cardController));

// Get default card
router.get("/default", authenticate, cardController.getDefaultCard.bind(cardController));

// Get single card
router.get(
  "/:id",
  authenticate,
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "Card ID must be a valid UUID",
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
  authorize("superadmin", "admin"),
  validate(createCardSchema),
  cardController.createCard.bind(cardController)
);

// Update card
router.put(
  "/:id",
  authenticate,
  authorize("superadmin", "admin"),
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "Card ID must be a valid UUID",
        "any.required": "Card ID is required",
      }),
    })
  ),
  validate(updateCardSchema),
  cardController.updateCard.bind(cardController)
);

// Delete card
router.delete(
  "/:id",
  authenticate,
  authorize("superadmin", "admin"),
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "Card ID must be a valid UUID",
        "any.required": "Card ID is required",
      }),
    })
  ),
  cardController.deleteCard.bind(cardController)
);

export default router;


