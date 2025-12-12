import { Router } from "express";
import { body, validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// Get all roles (from enum, but we can extend with custom roles)
router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
    // Return default roles from enum
    const defaultRoles = [
      { name: "superadmin", label: "Super Admin", description: "Full system access" },
      { name: "admin", label: "Admin", description: "Administrative access" },
      { name: "cashier", label: "Cashier", description: "Sales and billing access" },
      { name: "warehouse_manager", label: "Warehouse Manager", description: "Inventory management access" },
    ];

    res.json(defaultRoles);
  } catch (error) {
    logger.error("Get roles error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

