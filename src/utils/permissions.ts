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
    "/reports/opening-balance",
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
    "/reports/opening-balance",
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

  // Dashboard and Profile are accessible to everyone
  if (path === "/" || path === "/profile") {
    return true;
  }

  // If user has custom permissions (is an Array), we use STRICT permission checking.
  // We do NOT fall back to role-based permissions if the array is present (even if empty).
  if (Array.isArray(userPermissions)) {
    // Check if path matches any permission
    const hasPathPermission = userPermissions.some((perm) => {
      // Exact match
      if (perm === path) return true;
      // Pattern matching for dynamic routes
      const pattern = perm.replace(/:[^/]+/g, "[^/]+");
      const regex = new RegExp(`^${pattern}$`);
      return regex.test(path);
    });

    if (hasPathPermission) return true;

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

    if (hasActionPermission) return true;

    // Map action-based permissions to paths for route protection
    const actionToPathMappings: Record<string, string[]> = {
      "sales:view": ["/sales", "/sales/bill/:billNumber", "/sales/payment/:billNumber/:paymentIndex", "/sales/payments/:billNumber"],
      "sales:create": ["/sales/entry"],
      "sales:update": ["/sales/edit/:id"],
      "sales:cancel": ["/sales"], // No specific route, but allows button on /sales
      "sales:add_payment": ["/sales"], // No specific route

      "products:view": ["/inventory/products"],
      "products:create": ["/inventory/product/add"],
      "products:update": ["/inventory/product/edit/:id"],
      "products:delete": ["/inventory/products"],

      "purchases:view": ["/inventory/purchases", "/inventory/purchase/view/:id", "/inventory/purchase/payment/:purchaseId/:paymentIndex", "/inventory/purchase/payments/:purchaseId"],
      "purchases:create": ["/inventory/purchase"],
      "purchases:update": ["/inventory/purchase/edit/:id"],
      "purchases:cancel": ["/inventory/purchases"],
      "purchases:add_payment": ["/inventory/purchases"],

      "expenses:view": ["/expenses"],
      "expenses:create": ["/expenses/add"],
      "expenses:update": ["/expenses/edit/:id"],
      "expenses:delete": ["/expenses"],

      "users:view": ["/users"],
      "users:create": ["/users/add"],
      "users:update": ["/users/edit/:id"],
      "users:delete": ["/users"],

      "settings:view": ["/settings"],
      "settings:update": ["/settings"],

      "reports:view": ["/reports"],
      "opening_balance:view": ["/reports/opening-balance"],
      "opening_balance:create": ["/reports/opening-balance"],
      "opening_balance:update": ["/reports/opening-balance"],
      "opening_balance:delete": ["/reports/opening-balance"],

      "bank_accounts:view": ["/settings"], // Usually accessed via settings/finance
      "bank_accounts:create": ["/settings"],
      "bank_accounts:update": ["/settings"],
      "bank_accounts:delete": ["/settings"],

      "cards:view": ["/settings"],
      "cards:create": ["/settings"],
      "cards:update": ["/settings"],
      "cards:delete": ["/settings"],

      "backup:export": ["/settings"],
    };

    const hasMappedPathPermission = userPermissions.some((perm) => {
      const paths = actionToPathMappings[perm] || [];
      return paths.some((p) => {
        if (p === path) return true;
        const pattern = p.replace(/:[^/]+/g, "[^/]+");
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(path);
      });
    });

    if (hasMappedPathPermission) return true;

    // STRICT MODE: If user has permissions array defined, do NOT fallback to role defaults.
    return false;
  }

  // Fallback to role-based permissions (ONLY for legacy users without permissions array)
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

// Check if user has permission to access a specific resource
export const hasResourcePermission = (
  userRole: UserRole,
  resource: string,
  userPermissions?: string[]
): boolean => {
  // Superadmin has access to everything
  if (userRole === "superadmin") {
    return true;
  }

  // If custom permissions are present (Strict Mode), use them exclusively for ALL roles including Admin
  // If the array exists (even if empty, though UserForm validates > 0), we use it.
  if (Array.isArray(userPermissions)) {
    // If empty array, it means NO access (since we are in strict mode)
    if (userPermissions.length === 0) {
      return false;
    }
    // Proceed to check permissions logic...
  } else {
    // Legacy Fallback: userPermissions is undefined/null
    // Admin has access to everything in legacy mode
    if (userRole === "admin") {
      return true;
    }
    // No permissions and not admin = no access
    return false;
  }

  // At this point we know userPermissions is an array and has length > 0


  // Check for exact permission match
  if (userPermissions.includes(resource)) {
    return true;
  }

  // Check for wildcard permissions (e.g., "sales:*" matches "sales:view")
  const hasWildcard = userPermissions.some((perm) => {
    if (perm.endsWith(":*")) {
      const prefix = perm.slice(0, -2);
      return resource.startsWith(prefix);
    }
    return false;
  });

  if (hasWildcard) {
    return true;
  }

  // Special auto-grant rules (same as backend)
  // Users with sales/purchase permissions can view products
  if (resource === "products:view") {
    return userPermissions.some((p) => p.includes("sales") || p.includes("purchases"));
  }

  // Users with sales/purchase/expense permissions can view cards and bank accounts
  if (resource === "cards:view" || resource === "bank_accounts:view") {
    return userPermissions.some((p) => p.includes("sales") || p.includes("purchases") || p.includes("expenses"));
  }

  // Users with expense permissions can view expense categories
  if (resource === "expense_categories:view") {
    return userPermissions.some((p) => p.includes("expenses"));
  }

  // Users with product permissions can view categories and brands
  if (resource === "categories:view" || resource === "brands:view") {
    return userPermissions.some((p) => p.includes("products"));
  }

  // Users with purchase permissions can view suppliers
  if (resource === "suppliers:view") {
    return userPermissions.some((p) => p.includes("purchases"));
  }

  // Users with settings permissions can view settings
  if (resource === "settings:view") {
    return userPermissions.some((p) => p.includes("settings"));
  }

  return false;
};
