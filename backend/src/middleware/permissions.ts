import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "./auth";

// Check if user has a specific permission
export const hasPermission = (
  req: AuthRequest,
  requiredPermission: string
): boolean => {
  if (!req.user) {
    return false;
  }

  // Superadmin has all permissions
  if (req.user.role === "superadmin") {
    return true;
  }

  // Get user permissions from database (would need to fetch user)
  // For now, we'll check in the route handlers
  return false;
};

// Middleware to check permission
export const requirePermission = (permission: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Superadmin has all permissions
    if (req.user.role === "superadmin") {
      return next();
    }

    // In a real implementation, you would fetch the user from database
    // and check their permissions array
    // For now, we'll rely on role-based checks in routes

    next();
  };
};

