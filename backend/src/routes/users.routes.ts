import express, { Router } from "express";
import userController from "../controllers/user.controller";
import { authenticate, authorize } from "../middleware/auth";
import { validate, validateParams } from "../middleware/validate";
import {
  createUserSchema,
  updateUserSchema,
  updateProfileSchema,
} from "../validators/user.validator";
import Joi from "joi";

const router = Router();

// Get all users
router.get(
  "/",
  authenticate,
  authorize("superadmin", "admin"),
  userController.getUsers.bind(userController)
);

// Update own profile (any authenticated user)
router.put(
  "/profile",
  authenticate,
  validate(updateProfileSchema),
  userController.updateProfile.bind(userController)
);

// Get single user
router.get(
  "/:id",
  authenticate,
  authorize("superadmin", "admin"),
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "User ID must be a valid UUID",
        "any.required": "User ID is required",
      }),
    })
  ),
  userController.getUser.bind(userController)
);

// Create user
router.post(
  "/",
  authenticate,
  authorize("superadmin", "admin"),
  validate(createUserSchema),
  userController.createUser.bind(userController)
);

// Update user (admin/superadmin only)
router.put(
  "/:id",
  authenticate,
  authorize("superadmin", "admin"),
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "User ID must be a valid UUID",
        "any.required": "User ID is required",
      }),
    })
  ),
  validate(updateUserSchema),
  userController.updateUser.bind(userController)
);

// Delete user
router.delete(
  "/:id",
  authenticate,
  authorize("superadmin", "admin"),
  validateParams(
    Joi.object({
      id: Joi.string().uuid().required().messages({
        "string.uuid": "User ID must be a valid UUID",
        "any.required": "User ID is required",
      }),
    })
  ),
  userController.deleteUser.bind(userController)
);

export default router;
