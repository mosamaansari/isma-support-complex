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

  // Superadmin and admin roles have all permissions bypass
  if (req.user.role === "superadmin" || req.user.role === "admin") {
    return true;
  }

  // For AdminUser table (userType === "admin"), they have all permissions
  if (req.user.userType === "admin") {
    return true;
  }

  // Check user permissions
  const userPermissions = req.user.permissions || [];

  // 1. Check exact match
  if (userPermissions.includes(requiredPermission)) {
    return true;
  }

  // 2. Check pattern matching (e.g., "sales:*" matches "sales:create")
  const matchesPattern = userPermissions.some((perm) => {
    if (perm.endsWith("*")) {
      const prefix = perm.slice(0, -1);
      return requiredPermission.startsWith(prefix);
    }
    return false;
  });

  if (matchesPattern) {
    return true;
  }

  // 3. Special permission mappings based on core module needs

  // Products Viewing: Users with sales or purchase permissions often need to view products
  if (requiredPermission === "products:view") {
    if (userPermissions.some((p) => p.includes("sales") || p.includes("purchases"))) {
      return true;
    }
  }

  // Bank/Cards Viewing: Users creating entries often need to select bank accounts/cards
  if (requiredPermission === "bank_accounts:view" || requiredPermission === "cards:view") {
    if (userPermissions.some((p) => p.includes("sales") || p.includes("purchases") || p.includes("expenses"))) {
      return true;
    }
  }

  // Suppliers Viewing: Users creating purchases need to view suppliers
  if (requiredPermission === "suppliers:view") {
    if (userPermissions.some((p) => p.includes("purchases"))) {
      return true;
    }
  }

  // Account/Opening Balance Viewing:
  if (requiredPermission === "opening_balance:view") {
    if (userPermissions.some((p) => p.includes("sales") || p.includes("purchases") || p.includes("expenses"))) {
      return true;
    }
  }

  // 4. Role-based fallback for core operational flow if permissions array is empty or missing specific view
  if (req.user.role === "cashier") {
    if (requiredPermission === "sales:view" ||
      requiredPermission === "sales:create" ||
      requiredPermission === "products:view" ||
      requiredPermission === "opening_balance:view") {
      return true;
    }
  }

  if (req.user.role === "warehouse_manager") {
    if (requiredPermission === "products:view" ||
      requiredPermission === "products:create" ||
      requiredPermission === "products:update" ||
      requiredPermission === "purchases:view" ||
      requiredPermission === "purchases:create" ||
      requiredPermission === "opening_balance:view") {
      return true;
    }
  }

  return false;
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

    // Bypass for superadmin/admin roles and admin type users
    if (req.user.userType === "admin" || req.user.role === "superadmin" || req.user.role === "admin") {
      return next();
    }

    // Refresh permissions from DB if not present in request (though auth middleware should handle this)
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
        error: `Insufficient permissions. Required: ${permission}`,
      });
    }

    next();
  };
};
