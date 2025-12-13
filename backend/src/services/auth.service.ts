import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient, UserRole } from "@prisma/client";
import prisma from "../config/database";
import redis from "../config/redis";
import logger from "../utils/logger";

class AuthService {
  async login(username: string, password: string) {
    // ONLY check users table (regular users - cashier/warehouse_manager)
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
      logger.warn(`Failed login attempt for username: ${username} (not found in users table)`);
      throw new Error("Invalid credentials");
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      logger.warn(`Failed login attempt for username: ${username} (invalid password)`);
      throw new Error("Invalid credentials");
    }

    const jwtSecret = process.env.JWT_SECRET || "your-secret-key";
    const expiresIn = process.env.JWT_EXPIRE || "7d";
    const token = jwt.sign({ userId: user.id, userType: "user" }, jwtSecret, { expiresIn } as any);

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
        userType: "user",
      },
    };
  }

  async superAdminLogin(username: string, password: string) {
    // ONLY check admin_users table (superadmin/admin)
    const adminUser = await prisma.adminUser.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        password: true,
        role: true,
        name: true,
        email: true,
        profilePicture: true,
      },
    });

    if (!adminUser) {
      logger.warn(`Failed superadmin login attempt for username: ${username} (not found in admin_users table)`);
      throw new Error("Invalid superadmin credentials");
    }

    // Allow both superadmin and admin to login via this endpoint
    if (adminUser.role !== "superadmin" && adminUser.role !== "admin") {
      logger.warn(`Failed admin login attempt for username: ${username} (invalid role: ${adminUser.role})`);
      throw new Error("Invalid admin credentials");
    }

    const isValidPassword = await bcrypt.compare(password, adminUser.password);
    if (!isValidPassword) {
      logger.warn(`Failed admin login attempt for username: ${username} (invalid password)`);
      throw new Error("Invalid admin credentials");
    }

    const jwtSecret = process.env.JWT_SECRET || "your-secret-key";
    const expiresIn = process.env.JWT_EXPIRE || "7d";
    const token = jwt.sign({ userId: adminUser.id, userType: "admin" }, jwtSecret, { expiresIn } as any);

    const expirySeconds = expiresIn === "7d" ? 7 * 24 * 60 * 60 : 24 * 60 * 60;
    await redis.setex(`token:${adminUser.id}`, expirySeconds, token);

    logger.info(`Admin logged in: ${adminUser.username} (${adminUser.role})`);

    return {
      token,
      user: {
        id: adminUser.id,
        username: adminUser.username,
        name: adminUser.name,
        email: adminUser.email,
        role: adminUser.role,
        profilePicture: adminUser.profilePicture,
        permissions: [] as string[],
        userType: "admin",
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


