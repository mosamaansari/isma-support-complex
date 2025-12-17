import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../config/database";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: string;
    permissions?: string[];
    userType?: "user" | "admin";
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        message: "Authentication required",
        response: null,
        error: "Authentication required",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "your-secret-key"
    ) as { userId: string; userType?: "user" | "admin" };

    let user: any = null;

    // Check based on userType
    if (decoded.userType === "admin") {
      user = await prisma.adminUser.findUnique({
        where: { id: decoded.userId },
        select: { id: true, username: true, role: true },
      });
      if (user) {
        user.permissions = [];
        user.userType = "admin";
      }
    } else {
      // Default to regular user
      user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, username: true, role: true, permissions: true },
      });
      if (user) {
        user.userType = "user";
      }
    }

    // If not found, try the other table (for backward compatibility)
    if (!user) {
      user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, username: true, role: true, permissions: true },
      });
      if (user) {
        user.userType = "user";
      } else {
        const adminUser = await prisma.adminUser.findUnique({
          where: { id: decoded.userId },
          select: { id: true, username: true, role: true },
        });
        if (adminUser) {
          user = { ...adminUser, permissions: [], userType: "admin" };
        }
      }
    }

    if (!user) {
      return res.status(401).json({
        message: "User not found",
        response: null,
        error: "User not found",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid token",
      response: null,
      error: "Invalid token",
    });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required",
        response: null,
        error: "Authentication required",
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Insufficient permissions",
        response: null,
        error: "Insufficient permissions",
      });
    }

    next();
  };
};

