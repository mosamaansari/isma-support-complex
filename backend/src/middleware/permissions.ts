import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "./auth";
import prisma from "../config/database";

// Check if user has a specific permission
export const hasPermission = (
  req: AuthRequest,
  requiredPermission: string
): boolean => {
  if (!req.user) {
    return false;
  }

  // Superadmin and admin have all permissions
  if (req.user.role === "superadmin" || req.user.role === "admin") {
    return true;
  }

  // Check user permissions
  const userPermissions = req.user.permissions || [];
  
  // Check exact match
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }

  // Check pattern matching (e.g., "sales:*" matches "sales:create")
  return userPermissions.some((perm) => {
    if (perm.endsWith("*")) {
      const prefix = perm.slice(0, -1);
      return requiredPermission.startsWith(prefix);
    }
    return false;
  });
};

// Middleware to check permission
export const requirePermission = (permission: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Superadmin and admin have all permissions
    if (req.user.role === "superadmin" || req.user.role === "admin") {
      return next();
    }

    // Fetch user with permissions if not already loaded
    if (!req.user.permissions) {
      if (req.user.userType === "admin") {
        // Admin users don't have permissions array
        return next();
      } else {
        const user = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { permissions: true },
        });
        if (user) {
          req.user.permissions = user.permissions || [];
        }
      }
    }

    // Check if user has the required permission
    if (!hasPermission(req, permission)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
};


