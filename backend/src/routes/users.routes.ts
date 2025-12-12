import { Router } from "express";
import { body, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// Get all users
router.get("/", authenticate, authorize("superadmin", "admin"), async (req: AuthRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        profilePicture: true,
        permissions: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(users);
  } catch (error) {
    logger.error("Get users error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get single user
router.get("/:id", authenticate, authorize("superadmin", "admin"), async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        profilePicture: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    logger.error("Get user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Create user
router.post(
  "/",
  authenticate,
  authorize("superadmin", "admin"),
  [
    body("username").notEmpty().withMessage("Username is required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("name").notEmpty().withMessage("Name is required"),
    body("role").isIn(["superadmin", "admin", "cashier", "warehouse_manager"]).withMessage("Invalid role"),
  ],
  async (req: AuthRequest, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Check if username exists
      const existingUser = await prisma.user.findUnique({
        where: { username: req.body.username },
      });

      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Only superadmin can create superadmin
      if (req.body.role === "superadmin" && req.user?.role !== "superadmin") {
        return res.status(403).json({ error: "Only superadmin can create superadmin users" });
      }

      const hashedPassword = await bcrypt.hash(req.body.password, 10);

      const user = await prisma.user.create({
        data: {
          username: req.body.username,
          password: hashedPassword,
          name: req.body.name,
          email: req.body.email,
          role: req.body.role,
          permissions: req.body.permissions || [],
        },
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          role: true,
          permissions: true,
          profilePicture: true,
          createdAt: true,
        },
      });

      logger.info(`User created: ${user.username} by ${req.user?.username}`);
      res.status(201).json(user);
    } catch (error) {
      logger.error("Create user error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Update own profile (any authenticated user)
router.put(
  "/profile",
  authenticate,
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const updateData: any = {
        name: req.body.name,
        email: req.body.email,
        profilePicture: req.body.profilePicture || null,
      };

      // If password is being changed, verify current password first
      if (req.body.password) {
        if (!req.body.currentPassword) {
          return res.status(400).json({ error: "Current password is required to change password" });
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(req.body.currentPassword, user.password);
        if (!isPasswordValid) {
          return res.status(401).json({ error: "Current password is incorrect" });
        }

        // Hash new password
        updateData.password = await bcrypt.hash(req.body.password, 10);
      }

      const updatedUser = await prisma.user.update({
        where: { id: req.user.id },
        data: updateData,
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          role: true,
          permissions: true,
          profilePicture: true,
          createdAt: true,
        },
      });

      logger.info(`Profile updated: ${updatedUser.username}`);
      res.json(updatedUser);
    } catch (error) {
      logger.error("Update profile error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Update user (admin/superadmin only)
router.put(
  "/:id",
  authenticate,
  authorize("superadmin", "admin"),
  async (req: AuthRequest, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.params.id },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Only superadmin can update superadmin
      if (user.role === "superadmin" && req.user?.role !== "superadmin") {
        return res.status(403).json({ error: "Only superadmin can update superadmin users" });
      }

      const updateData: any = {
        name: req.body.name,
        email: req.body.email,
        role: req.body.role,
        profilePicture: req.body.profilePicture || null,
        permissions: req.body.permissions || [],
      };

      if (req.body.password) {
        updateData.password = await bcrypt.hash(req.body.password, 10);
      }

      const updatedUser = await prisma.user.update({
        where: { id: req.params.id },
        data: updateData,
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          role: true,
          permissions: true,
          profilePicture: true,
          createdAt: true,
        },
      });

      logger.info(`User updated: ${updatedUser.username} by ${req.user?.username}`);
      res.json(updatedUser);
    } catch (error) {
      logger.error("Update user error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Delete user
router.delete(
  "/:id",
  authenticate,
  authorize("superadmin", "admin"),
  async (req: AuthRequest, res) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.params.id },
      });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Cannot delete own account
      if (user.id === req.user?.id) {
        return res.status(400).json({ error: "Cannot delete your own account" });
      }

      // Only superadmin can delete superadmin
      if (user.role === "superadmin" && req.user?.role !== "superadmin") {
        return res.status(403).json({ error: "Only superadmin can delete superadmin users" });
      }

      await prisma.user.delete({
        where: { id: req.params.id },
      });

      logger.info(`User deleted: ${user.username} by ${req.user?.username}`);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      logger.error("Delete user error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;

