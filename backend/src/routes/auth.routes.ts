import { Router } from "express";
import { body, validationResult } from "express-validator";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger";
import redis from "../config/redis";

const router = Router();
const prisma = new PrismaClient();

// Login
router.post(
  "/login",
  [
    body("username").notEmpty().withMessage("Username is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { username },
      });

      if (!user) {
        logger.warn(`Failed login attempt for username: ${username}`);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        logger.warn(`Failed login attempt for username: ${username}`);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET || "your-secret-key",
        { expiresIn: process.env.JWT_EXPIRE || "7d" }
      );

      // Store token in Redis
      await redis.setex(`token:${user.id}`, 7 * 24 * 60 * 60, token);

      logger.info(`User logged in: ${user.username} (${user.role})`);

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
          profilePicture: user.profilePicture,
          permissions: user.permissions || [],
        },
      });
    } catch (error) {
      logger.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// SuperAdmin Login
router.post(
  "/superadmin/login",
  [
    body("username").notEmpty().withMessage("Username is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password } = req.body;

      const user = await prisma.user.findUnique({
        where: { username },
      });

      if (!user || user.role !== "superadmin") {
        logger.warn(`Failed superadmin login attempt for username: ${username}`);
        return res.status(401).json({ error: "Invalid superadmin credentials" });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        logger.warn(`Failed superadmin login attempt for username: ${username}`);
        return res.status(401).json({ error: "Invalid superadmin credentials" });
      }

      const token = jwt.sign(
        { userId: user.id },
        process.env.JWT_SECRET || "your-secret-key",
        { expiresIn: process.env.JWT_EXPIRE || "7d" }
      );

      await redis.setex(`token:${user.id}`, 7 * 24 * 60 * 60, token);

      logger.info(`SuperAdmin logged in: ${user.username}`);

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
          profilePicture: user.profilePicture,
          permissions: user.permissions || [],
        },
      });
    } catch (error) {
      logger.error("SuperAdmin login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// Logout
router.post("/logout", async (req, res) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      const decoded = jwt.decode(token) as { userId: string } | null;
      if (decoded?.userId) {
        await redis.del(`token:${decoded.userId}`);
      }
    }
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    logger.error("Logout error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

