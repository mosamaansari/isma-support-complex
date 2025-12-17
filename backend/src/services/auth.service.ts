import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import prisma from "../config/database";
import redis from "../config/redis";
import logger from "../utils/logger";
import emailService from "./email.service";

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
    const expiresIn = "24h"; // 24 hours session
    const token = jwt.sign({ userId: user.id, userType: "user" }, jwtSecret, { expiresIn } as any);

    // Store token in Redis (24 hours = 86400 seconds)
    const expirySeconds = 24 * 60 * 60;
    await redis.setex(`token:${user.id}`, expirySeconds, token);

    logger.info(`User logged in: ${user.username} (${user.role})`);

    // Send login email if email exists
    if (user.email) {
      const loginTime = new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" });
      emailService.sendLoginEmail(user.email, user.name, loginTime).catch((err) => {
        logger.error("Failed to send login email:", err);
      });
    }

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
    const expiresIn = "24h"; // 24 hours session
    const token = jwt.sign({ userId: adminUser.id, userType: "admin" }, jwtSecret, { expiresIn } as any);

    // Store token in Redis (24 hours = 86400 seconds)
    const expirySeconds = 24 * 60 * 60;
    await redis.setex(`token:${adminUser.id}`, expirySeconds, token);

    logger.info(`Admin logged in: ${adminUser.username} (${adminUser.role})`);

    // Send login email if email exists
    if (adminUser.email) {
      const loginTime = new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" });
      emailService.sendLoginEmail(adminUser.email, adminUser.name, loginTime).catch((err) => {
        logger.error("Failed to send login email:", err);
      });
    }

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

  async forgotPassword(email: string, userType: "user" | "admin" = "user") {
    let user: { id: string; name: string; email: string } | null = null;

    if (userType === "admin") {
      user = await prisma.adminUser.findFirst({
        where: { email },
        select: { id: true, name: true, email: true },
      });
    } else {
      user = await prisma.user.findFirst({
        where: { email },
        select: { id: true, name: true, email: true },
      });
    }

    if (!user) {
      // Don't reveal if email exists or not for security
      return { message: "If the email exists, a password reset link has been sent." };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token in database
    if (userType === "admin") {
      await prisma.adminUser.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpiry,
        },
      });
    } else {
      // Add resetToken and resetTokenExpiry to User model if not exists
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpiry,
        } as any,
      });
    }

    // Send email
    await emailService.sendForgotPasswordEmail(user.email, user.name, resetToken);

    return { message: "If the email exists, a password reset link has been sent." };
  }

  async resetPassword(token: string, newPassword: string, userType: "user" | "admin" = "user") {
    let user: { id: string; name: string; email: string; resetToken: string | null; resetTokenExpiry: Date | null } | null = null;

    if (userType === "admin") {
      user = await prisma.adminUser.findFirst({
        where: {
          resetToken: token,
          resetTokenExpiry: {
            gt: new Date(),
          },
        },
        select: { id: true, name: true, email: true, resetToken: true, resetTokenExpiry: true },
      });
    } else {
      user = await prisma.user.findFirst({
        where: {
          resetToken: token,
          resetTokenExpiry: {
            gt: new Date(),
          },
        },
        select: { id: true, name: true, email: true, resetToken: true, resetTokenExpiry: true },
      } as any);
    }

    if (!user || !user.resetToken || !user.resetTokenExpiry) {
      throw new Error("Invalid or expired reset token");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    if (userType === "admin") {
      await prisma.adminUser.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpiry: null,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpiry: null,
        } as any,
      });
    }

    // Send success email
    await emailService.sendPasswordResetSuccessEmail(user.email, user.name);

    return { message: "Password has been reset successfully" };
  }
}

export default new AuthService();


