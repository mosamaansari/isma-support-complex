import express, { Router } from "express";
import userController from "../controllers/user.controller";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { bodyValidator, queryValidator, paramsValidator } from "../middleware/joiValidator";
import {
  createUserSchema,
  updateUserSchema,
  updateProfileSchema,
  updatePasswordSchema,
  getUsersQuerySchema,
} from "../validators/user.validator";
import { PERMISSIONS } from "../utils/permissions";
import Joi from "joi";

const router = Router();

// Get current user profile
router.get("/profile", authenticate, userController.getProfile.bind(userController));

// Update current user profile
router.put(
  "/profile",
  authenticate,
  bodyValidator(updateProfileSchema),
  userController.updateProfile.bind(userController)
);

// Update current user password
router.put(
  "/profile/password",
  authenticate,
  bodyValidator(updatePasswordSchema),
  userController.updatePassword.bind(userController)
);

// Get all users (admin/superadmin only)
router.get(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.USERS_VIEW),
  queryValidator(getUsersQuerySchema),
  userController.getUsers.bind(userController)
);

// Get single user
router.get(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.USERS_VIEW),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "User ID is required",
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
  requirePermission(PERMISSIONS.USERS_CREATE),
  bodyValidator(createUserSchema),
  userController.createUser.bind(userController)
);

// Update user (admin/superadmin only)
router.put(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.USERS_UPDATE),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "User ID is required",
        "any.required": "User ID is required",
      }),
    })
  ),
  bodyValidator(updateUserSchema),
  userController.updateUser.bind(userController)
);

// Delete user
router.delete(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.USERS_DELETE),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "User ID is required",
        "any.required": "User ID is required",
      }),
    })
  ),
  userController.deleteUser.bind(userController)
);

export default router;
