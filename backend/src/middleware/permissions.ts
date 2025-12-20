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

  // Special permission mappings:
  // Users with sales, purchase, or expense permissions can also access:
  // - Daily confirmation (for daily balance confirmation)
  // - Opening balance view (to see balances)
  // - Balance transactions view (to see transaction history)
  if (requiredPermission === "daily_confirmation:view" || 
      requiredPermission === "daily_confirmation:confirm") {
    if (userPermissions.some((p) => p.includes("sales") || p.includes("purchase") || p.includes("expense"))) {
      return true;
    }
  }
  
  if (requiredPermission === "opening_balance:view" || 
      requiredPermission === "closing_balance:view" ||
      requiredPermission === "balance_transactions:view") {
    if (userPermissions.some((p) => p.includes("sales") || p.includes("purchase") || p.includes("expense"))) {
      return true;
    }
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
      return res.status(401).json({
        message: "Authentication required",
        response: null,
        error: "Authentication required",
      });
    }

    // If user is from AdminUser table (userType === "admin"), they have all permissions
    if (req.user.userType === "admin") {
      return next();
    }

    // For users from User table, check their role and permissions
    // Superadmin and admin roles from User table also have all permissions
    if (req.user.role === "superadmin" || req.user.role === "admin") {
      return next();
    }

    // Fetch user with permissions if not already loaded
    if (!req.user.permissions) {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { permissions: true },
      });
      if (user) {
        req.user.permissions = user.permissions || [];
      }
    }

    // Check if user has the required permission
    if (!hasPermission(req, permission)) {
      return res.status(403).json({
        message: "Insufficient permissions",
        response: null,
        error: "Insufficient permissions",
      });
    }

    next();
  };
};


