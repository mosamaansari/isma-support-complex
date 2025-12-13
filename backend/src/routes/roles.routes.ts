import express, { Router } from "express";
import roleController from "../controllers/role.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

// Get all roles
router.get("/", authenticate, roleController.getRoles.bind(roleController));

export default router;
