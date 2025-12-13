import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient, UserRole } from "@prisma/client";
import prisma from "../config/database";
import redis from "../config/redis";
import logger from "../utils/logger";

class AuthService {
  async login(username: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        password: true,
        role: true,
        name: true,
        email: true,
        profilePicture: true,
        permissions: true,
      },
    });

    if (!user) {
      logger.warn(`Failed login attempt for username: ${username}`);
      throw new Error("Invalid credentials");
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      logger.warn(`Failed login attempt for username: ${username}`);
      throw new Error("Invalid credentials");
    }

    const jwtSecret = process.env.JWT_SECRET || "your-secret-key";
    const expiresIn = process.env.JWT_EXPIRE || "7d";
    const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn } as any);

    // Store token in Redis
    const expirySeconds = expiresIn === "7d" ? 7 * 24 * 60 * 60 : 24 * 60 * 60;
    await redis.setex(`token:${user.id}`, expirySeconds, token);

    logger.info(`User logged in: ${user.username} (${user.role})`);

    return {
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
    };
  }

  async superAdminLogin(username: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user || user.role !== "superadmin") {
      logger.warn(`Failed superadmin login attempt for username: ${username}`);
      throw new Error("Invalid superadmin credentials");
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      logger.warn(`Failed superadmin login attempt for username: ${username}`);
      throw new Error("Invalid superadmin credentials");
    }

    const jwtSecret = process.env.JWT_SECRET || "your-secret-key";
    const expiresIn = process.env.JWT_EXPIRE || "7d";
    const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn } as any);

    const expirySeconds = expiresIn === "7d" ? 7 * 24 * 60 * 60 : 24 * 60 * 60;
    await redis.setex(`token:${user.id}`, expirySeconds, token);

    logger.info(`SuperAdmin logged in: ${user.username}`);

    return {
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
    };
  }

  async logout(token: string) {
    try {
      const decoded = jwt.decode(token) as { userId: string } | null;
      if (decoded?.userId) {
        await redis.del(`token:${decoded.userId}`);
      }
    } catch (error) {
      logger.error("Logout error:", error);
      throw error;
    }
  }
}

export default new AuthService();


