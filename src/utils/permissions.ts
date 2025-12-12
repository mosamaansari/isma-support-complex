import { UserRole } from "../types";

// Define which pages each role can access
export const rolePermissions: Record<UserRole, string[]> = {
  superadmin: [
    "/",
    "/profile",
    "/sales",
    "/sales/entry",
    "/sales/bill/:billNumber",
    "/inventory/products",
    "/inventory/product/add",
    "/inventory/product/edit/:id",
    "/inventory/purchase",
    "/inventory/purchases",
    "/expenses",
    "/expenses/add",
    "/expenses/edit/:id",
    "/reports",
    "/users",
    "/users/add",
    "/users/edit/:id",
    "/settings",
  ],
  admin: [
    "/",
    "/profile",
    "/sales",
    "/sales/entry",
    "/sales/bill/:billNumber",
    "/inventory/products",
    "/inventory/product/add",
    "/inventory/product/edit/:id",
    "/inventory/purchase",
    "/inventory/purchases",
    "/expenses",
    "/expenses/add",
    "/expenses/edit/:id",
    "/reports",
    "/users",
    "/users/add",
    "/users/edit/:id",
    "/settings",
  ],
  cashier: [
    "/",
    "/profile",
    "/sales",
    "/sales/entry",
    "/sales/bill/:billNumber",
  ],
  warehouse_manager: [
    "/",
    "/profile",
    "/inventory/products",
    "/inventory/product/add",
    "/inventory/product/edit/:id",
    "/inventory/purchase",
    "/inventory/purchases",
  ],
};

// Check if user has permission to access a path
export const hasPermission = (
  userRole: UserRole,
  path: string,
  userPermissions?: string[]
): boolean => {
  // Superadmin has access to everything
  if (userRole === "superadmin") {
    return true;
  }

  // If user has custom permissions, check those first
  if (userPermissions && userPermissions.length > 0) {
    // Check if path matches any permission
    const hasPathPermission = userPermissions.some((perm) => {
      // Exact match
      if (perm === path) return true;
      // Pattern matching for dynamic routes
      const pattern = perm.replace(/:[^/]+/g, "[^/]+");
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(path);
    });

    // Also check action-based permissions (e.g., "sales:cancel")
    const hasActionPermission = userPermissions.some((perm) => {
      if (perm.includes(":")) {
        // Action-based permission
        const [module, action] = perm.split(":");
        if (path.includes(module)) {
          // Check if this path requires this action
          if (action === "cancel" && path.includes("/cancel")) return true;
          if (action === "delete" && path.includes("/delete")) return true;
          if (action === "edit" && path.includes("/edit")) return true;
        }
      }
      return false;
    });

    if (hasPathPermission || hasActionPermission) {
      return true;
    }
  }

  // Fallback to role-based permissions
  const allowedPaths = rolePermissions[userRole] || [];
  
  // Exact match
  if (allowedPaths.includes(path)) {
    return true;
  }

  // Pattern matching for dynamic routes
  return allowedPaths.some((allowedPath) => {
    // Convert route pattern to regex
    const pattern = allowedPath.replace(/:[^/]+/g, "[^/]+");
    const regex = new RegExp(`^${pattern}$`);
    return regex.test(path);
  });
};

