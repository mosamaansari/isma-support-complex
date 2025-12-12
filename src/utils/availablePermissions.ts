// Available permissions in the system
export const AVAILABLE_PERMISSIONS = {
  // Sales & Billing
  SALES_VIEW: "/sales",
  SALES_CREATE: "/sales/entry",
  SALES_VIEW_BILL: "/sales/bill/:billNumber",
  SALES_CANCEL: "sales:cancel",
  
  // Inventory
  INVENTORY_VIEW: "/inventory/products",
  INVENTORY_ADD: "/inventory/product/add",
  INVENTORY_EDIT: "/inventory/product/edit/:id",
  INVENTORY_DELETE: "inventory:delete",
  PURCHASE_VIEW: "/inventory/purchases",
  PURCHASE_CREATE: "/inventory/purchase",
  
  // Expenses
  EXPENSES_VIEW: "/expenses",
  EXPENSES_ADD: "/expenses/add",
  EXPENSES_EDIT: "/expenses/edit/:id",
  EXPENSES_DELETE: "expenses:delete",
  
  // Reports
  REPORTS_VIEW: "/reports",
  REPORTS_SALES: "reports:sales",
  REPORTS_EXPENSES: "reports:expenses",
  REPORTS_PROFIT_LOSS: "reports:profit-loss",
  
  // Users (Admin only)
  USERS_VIEW: "/users",
  USERS_ADD: "/users/add",
  USERS_EDIT: "/users/edit/:id",
  USERS_DELETE: "users:delete",
  
  // Settings (Admin only)
  SETTINGS_VIEW: "/settings",
  SETTINGS_EDIT: "settings:edit",
} as const;

// Permission groups for UI
export const PERMISSION_GROUPS = [
  {
    group: "Sales & Billing",
    permissions: [
      { key: "SALES_VIEW", label: "View Sales", value: AVAILABLE_PERMISSIONS.SALES_VIEW },
      { key: "SALES_CREATE", label: "Create Sale", value: AVAILABLE_PERMISSIONS.SALES_CREATE },
      { key: "SALES_VIEW_BILL", label: "View Bills", value: AVAILABLE_PERMISSIONS.SALES_VIEW_BILL },
      { key: "SALES_CANCEL", label: "Cancel Sale", value: AVAILABLE_PERMISSIONS.SALES_CANCEL },
    ],
  },
  {
    group: "Inventory",
    permissions: [
      { key: "INVENTORY_VIEW", label: "View Products", value: AVAILABLE_PERMISSIONS.INVENTORY_VIEW },
      { key: "INVENTORY_ADD", label: "Add Product", value: AVAILABLE_PERMISSIONS.INVENTORY_ADD },
      { key: "INVENTORY_EDIT", label: "Edit Product", value: AVAILABLE_PERMISSIONS.INVENTORY_EDIT },
      { key: "INVENTORY_DELETE", label: "Delete Product", value: AVAILABLE_PERMISSIONS.INVENTORY_DELETE },
      { key: "PURCHASE_VIEW", label: "View Purchases", value: AVAILABLE_PERMISSIONS.PURCHASE_VIEW },
      { key: "PURCHASE_CREATE", label: "Create Purchase", value: AVAILABLE_PERMISSIONS.PURCHASE_CREATE },
    ],
  },
  {
    group: "Expenses",
    permissions: [
      { key: "EXPENSES_VIEW", label: "View Expenses", value: AVAILABLE_PERMISSIONS.EXPENSES_VIEW },
      { key: "EXPENSES_ADD", label: "Add Expense", value: AVAILABLE_PERMISSIONS.EXPENSES_ADD },
      { key: "EXPENSES_EDIT", label: "Edit Expense", value: AVAILABLE_PERMISSIONS.EXPENSES_EDIT },
      { key: "EXPENSES_DELETE", label: "Delete Expense", value: AVAILABLE_PERMISSIONS.EXPENSES_DELETE },
    ],
  },
  {
    group: "Reports",
    permissions: [
      { key: "REPORTS_VIEW", label: "View Reports", value: AVAILABLE_PERMISSIONS.REPORTS_VIEW },
      { key: "REPORTS_SALES", label: "Sales Reports", value: AVAILABLE_PERMISSIONS.REPORTS_SALES },
      { key: "REPORTS_EXPENSES", label: "Expense Reports", value: AVAILABLE_PERMISSIONS.REPORTS_EXPENSES },
      { key: "REPORTS_PROFIT_LOSS", label: "Profit/Loss Reports", value: AVAILABLE_PERMISSIONS.REPORTS_PROFIT_LOSS },
    ],
  },
  {
    group: "User Management",
    permissions: [
      { key: "USERS_VIEW", label: "View Users", value: AVAILABLE_PERMISSIONS.USERS_VIEW },
      { key: "USERS_ADD", label: "Add User", value: AVAILABLE_PERMISSIONS.USERS_ADD },
      { key: "USERS_EDIT", label: "Edit User", value: AVAILABLE_PERMISSIONS.USERS_EDIT },
      { key: "USERS_DELETE", label: "Delete User", value: AVAILABLE_PERMISSIONS.USERS_DELETE },
    ],
  },
  {
    group: "Settings",
    permissions: [
      { key: "SETTINGS_VIEW", label: "View Settings", value: AVAILABLE_PERMISSIONS.SETTINGS_VIEW },
      { key: "SETTINGS_EDIT", label: "Edit Settings", value: AVAILABLE_PERMISSIONS.SETTINGS_EDIT },
    ],
  },
];

// Get default permissions for a role
export const getDefaultPermissionsForRole = (role: string): string[] => {
  const rolePermissions: Record<string, string[]> = {
    superadmin: Object.values(AVAILABLE_PERMISSIONS),
    admin: [
      AVAILABLE_PERMISSIONS.SALES_VIEW,
      AVAILABLE_PERMISSIONS.SALES_CREATE,
      AVAILABLE_PERMISSIONS.SALES_VIEW_BILL,
      AVAILABLE_PERMISSIONS.SALES_CANCEL,
      AVAILABLE_PERMISSIONS.INVENTORY_VIEW,
      AVAILABLE_PERMISSIONS.INVENTORY_ADD,
      AVAILABLE_PERMISSIONS.INVENTORY_EDIT,
      AVAILABLE_PERMISSIONS.INVENTORY_DELETE,
      AVAILABLE_PERMISSIONS.PURCHASE_VIEW,
      AVAILABLE_PERMISSIONS.PURCHASE_CREATE,
      AVAILABLE_PERMISSIONS.EXPENSES_VIEW,
      AVAILABLE_PERMISSIONS.EXPENSES_ADD,
      AVAILABLE_PERMISSIONS.EXPENSES_EDIT,
      AVAILABLE_PERMISSIONS.EXPENSES_DELETE,
      AVAILABLE_PERMISSIONS.REPORTS_VIEW,
      AVAILABLE_PERMISSIONS.REPORTS_SALES,
      AVAILABLE_PERMISSIONS.REPORTS_EXPENSES,
      AVAILABLE_PERMISSIONS.REPORTS_PROFIT_LOSS,
      AVAILABLE_PERMISSIONS.USERS_VIEW,
      AVAILABLE_PERMISSIONS.USERS_ADD,
      AVAILABLE_PERMISSIONS.USERS_EDIT,
      AVAILABLE_PERMISSIONS.USERS_DELETE,
      AVAILABLE_PERMISSIONS.SETTINGS_VIEW,
      AVAILABLE_PERMISSIONS.SETTINGS_EDIT,
    ],
    cashier: [
      AVAILABLE_PERMISSIONS.SALES_VIEW,
      AVAILABLE_PERMISSIONS.SALES_CREATE,
      AVAILABLE_PERMISSIONS.SALES_VIEW_BILL,
    ],
    warehouse_manager: [
      AVAILABLE_PERMISSIONS.INVENTORY_VIEW,
      AVAILABLE_PERMISSIONS.INVENTORY_ADD,
      AVAILABLE_PERMISSIONS.INVENTORY_EDIT,
      AVAILABLE_PERMISSIONS.PURCHASE_VIEW,
      AVAILABLE_PERMISSIONS.PURCHASE_CREATE,
    ],
  };

  return rolePermissions[role] || [];
};

