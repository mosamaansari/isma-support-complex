import express, { Router } from "express";
import roleController from "../controllers/role.controller";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { bodyValidator, paramsValidator } from "../middleware/joiValidator";
import { createRoleSchema, updateRoleSchema } from "../validators/role.validator";
import { PERMISSIONS } from "../utils/permissions";
import Joi from "joi";

const router = Router();

// Get all roles
router.get("/", authenticate, roleController.getRoles.bind(roleController));

// Create role
router.post(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.ROLES_CREATE),
  bodyValidator(createRoleSchema),
  roleController.createRole.bind(roleController)
);

// Update role
router.put(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.ROLES_UPDATE),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Role ID is required",
        "any.required": "Role ID is required",
      }),
    })
  ),
  bodyValidator(updateRoleSchema),
  roleController.updateRole.bind(roleController)
);

// Delete role
router.delete(
  "/:id",
  authenticate,
  requirePermission(PERMISSIONS.ROLES_DELETE),
  paramsValidator(
    Joi.object({
      id: Joi.string().required().trim().min(1).messages({
        "string.empty": "Role ID is required",
        "any.required": "Role ID is required",
      }),
    })
  ),
  roleController.deleteRole.bind(roleController)
);

export default router;
