import { UserRole } from "../types";

export const AVAILABLE_PERMISSIONS = {
  // Sales & Billing
  SALES_VIEW: "sales:view",
  SALES_CREATE: "sales:create",
  SALES_UPDATE: "sales:update",
  SALES_CANCEL: "sales:cancel",
  SALES_ADD_PAYMENT: "sales:add_payment",

  // Products
  PRODUCTS_VIEW: "products:view",
  PRODUCTS_CREATE: "products:create",
  PRODUCTS_UPDATE: "products:update",
  PRODUCTS_DELETE: "products:delete",

  // Purchases
  PURCHASES_VIEW: "purchases:view",
  PURCHASES_CREATE: "purchases:create",
  PURCHASES_UPDATE: "purchases:update",
  PURCHASES_CANCEL: "purchases:cancel",
  PURCHASES_ADD_PAYMENT: "purchases:add_payment",

  // Expenses
  EXPENSES_VIEW: "expenses:view",
  EXPENSES_CREATE: "expenses:create",
  EXPENSES_UPDATE: "expenses:update",
  EXPENSES_DELETE: "expenses:delete",

  // Opening Balance
  OPENING_BALANCE_VIEW: "opening_balance:view",
  OPENING_BALANCE_CREATE: "opening_balance:create",
  OPENING_BALANCE_UPDATE: "opening_balance:update",
  OPENING_BALANCE_DELETE: "opening_balance:delete",

  // Closing Balance
  CLOSING_BALANCE_VIEW: "closing_balance:view",
  CLOSING_BALANCE_CALCULATE: "closing_balance:calculate",


  // Bank Accounts
  BANK_ACCOUNTS_VIEW: "bank_accounts:view",
  BANK_ACCOUNTS_CREATE: "bank_accounts:create",
  BANK_ACCOUNTS_UPDATE: "bank_accounts:update",
  BANK_ACCOUNTS_DELETE: "bank_accounts:delete",

  // Cards
  CARDS_VIEW: "cards:view",
  CARDS_CREATE: "cards:create",
  CARDS_UPDATE: "cards:update",
  CARDS_DELETE: "cards:delete",

  // Reports
  REPORTS_VIEW: "reports:view",
  REPORTS_SALES: "reports:sales",
  REPORTS_EXPENSES: "reports:expenses",
  REPORTS_PROFIT_LOSS: "reports:profit-loss",

  // Users
  USERS_VIEW: "users:view",
  USERS_CREATE: "users:create",
  USERS_UPDATE: "users:update",
  USERS_DELETE: "users:delete",

  // Settings
  SETTINGS_VIEW: "settings:view",
  SETTINGS_UPDATE: "settings:update",

  // Roles
  ROLES_VIEW: "roles:view",
  ROLES_CREATE: "roles:create",
  ROLES_UPDATE: "roles:update",
  ROLES_DELETE: "roles:delete",

  // Backup
  BACKUP_EXPORT: "backup:export",
} as const;

export const PERMISSION_GROUPS = [
  {
    group: "Sales & Billing",
    permissions: [
      { key: "SALES_VIEW", label: "View Sales", value: AVAILABLE_PERMISSIONS.SALES_VIEW },
      { key: "SALES_CREATE", label: "Create Sale", value: AVAILABLE_PERMISSIONS.SALES_CREATE },
      { key: "SALES_UPDATE", label: "Update Sale", value: AVAILABLE_PERMISSIONS.SALES_UPDATE },
      { key: "SALES_CANCEL", label: "Cancel Sale", value: AVAILABLE_PERMISSIONS.SALES_CANCEL },
      { key: "SALES_ADD_PAYMENT", label: "Add Payment to Sale", value: AVAILABLE_PERMISSIONS.SALES_ADD_PAYMENT },
    ],
  },
  {
    group: "Products",
    permissions: [
      { key: "PRODUCTS_VIEW", label: "View Products", value: AVAILABLE_PERMISSIONS.PRODUCTS_VIEW },
      { key: "PRODUCTS_CREATE", label: "Create Product", value: AVAILABLE_PERMISSIONS.PRODUCTS_CREATE },
      { key: "PRODUCTS_UPDATE", label: "Update Product", value: AVAILABLE_PERMISSIONS.PRODUCTS_UPDATE },
      { key: "PRODUCTS_DELETE", label: "Delete Product", value: AVAILABLE_PERMISSIONS.PRODUCTS_DELETE },
    ],
  },
  {
    group: "Purchases",
    permissions: [
      { key: "PURCHASES_VIEW", label: "View Purchases", value: AVAILABLE_PERMISSIONS.PURCHASES_VIEW },
      { key: "PURCHASES_CREATE", label: "Create Purchase", value: AVAILABLE_PERMISSIONS.PURCHASES_CREATE },
      { key: "PURCHASES_UPDATE", label: "Update Purchase", value: AVAILABLE_PERMISSIONS.PURCHASES_UPDATE },
      { key: "PURCHASES_CANCEL", label: "Cancel Purchase", value: AVAILABLE_PERMISSIONS.PURCHASES_CANCEL },
      { key: "PURCHASES_ADD_PAYMENT", label: "Add Payment to Purchase", value: AVAILABLE_PERMISSIONS.PURCHASES_ADD_PAYMENT },
    ],
  },
  {
    group: "Expenses",
    permissions: [
      { key: "EXPENSES_VIEW", label: "View Expenses", value: AVAILABLE_PERMISSIONS.EXPENSES_VIEW },
      { key: "EXPENSES_CREATE", label: "Create Expense", value: AVAILABLE_PERMISSIONS.EXPENSES_CREATE },
      { key: "EXPENSES_UPDATE", label: "Update Expense", value: AVAILABLE_PERMISSIONS.EXPENSES_UPDATE },
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
    group: "Opening Balance",
    permissions: [
      { key: "OPENING_BALANCE_VIEW", label: "View Opening Balance", value: AVAILABLE_PERMISSIONS.OPENING_BALANCE_VIEW },
      { key: "OPENING_BALANCE_CREATE", label: "Create Opening Balance", value: AVAILABLE_PERMISSIONS.OPENING_BALANCE_CREATE },
      { key: "OPENING_BALANCE_UPDATE", label: "Update Opening Balance", value: AVAILABLE_PERMISSIONS.OPENING_BALANCE_UPDATE },
      { key: "OPENING_BALANCE_DELETE", label: "Delete Opening Balance", value: AVAILABLE_PERMISSIONS.OPENING_BALANCE_DELETE },
    ],
  },
  {
    group: "Closing Balance",
    permissions: [
      { key: "CLOSING_BALANCE_VIEW", label: "View Closing Balance", value: AVAILABLE_PERMISSIONS.CLOSING_BALANCE_VIEW },
      { key: "CLOSING_BALANCE_CALCULATE", label: "Calculate Closing Balance", value: AVAILABLE_PERMISSIONS.CLOSING_BALANCE_CALCULATE },
    ],
  },
  {
    group: "Bank Accounts",
    permissions: [
      { key: "BANK_ACCOUNTS_VIEW", label: "View Bank Accounts", value: AVAILABLE_PERMISSIONS.BANK_ACCOUNTS_VIEW },
      { key: "BANK_ACCOUNTS_CREATE", label: "Create Bank Account", value: AVAILABLE_PERMISSIONS.BANK_ACCOUNTS_CREATE },
      { key: "BANK_ACCOUNTS_UPDATE", label: "Update Bank Account", value: AVAILABLE_PERMISSIONS.BANK_ACCOUNTS_UPDATE },
      { key: "BANK_ACCOUNTS_DELETE", label: "Delete Bank Account", value: AVAILABLE_PERMISSIONS.BANK_ACCOUNTS_DELETE },
    ],
  },
  {
    group: "Cards",
    permissions: [
      { key: "CARDS_VIEW", label: "View Cards", value: AVAILABLE_PERMISSIONS.CARDS_VIEW },
      { key: "CARDS_CREATE", label: "Create Card", value: AVAILABLE_PERMISSIONS.CARDS_CREATE },
      { key: "CARDS_UPDATE", label: "Update Card", value: AVAILABLE_PERMISSIONS.CARDS_UPDATE },
      { key: "CARDS_DELETE", label: "Delete Card", value: AVAILABLE_PERMISSIONS.CARDS_DELETE },
    ],
  },
  {
    group: "User & Settings",
    permissions: [
      { key: "USERS_VIEW", label: "View Users", value: AVAILABLE_PERMISSIONS.USERS_VIEW },
      { key: "USERS_CREATE", label: "Create User", value: AVAILABLE_PERMISSIONS.USERS_CREATE },
      { key: "USERS_UPDATE", label: "Update User", value: AVAILABLE_PERMISSIONS.USERS_UPDATE },
      { key: "USERS_DELETE", label: "Delete User", value: AVAILABLE_PERMISSIONS.USERS_DELETE },
      { key: "SETTINGS_VIEW", label: "View Settings", value: AVAILABLE_PERMISSIONS.SETTINGS_VIEW },
      { key: "SETTINGS_UPDATE", label: "Update Settings", value: AVAILABLE_PERMISSIONS.SETTINGS_UPDATE },
      { key: "ROLES_VIEW", label: "View Roles", value: AVAILABLE_PERMISSIONS.ROLES_VIEW },
      { key: "ROLES_CREATE", label: "Create Role", value: AVAILABLE_PERMISSIONS.ROLES_CREATE },
      { key: "ROLES_UPDATE", label: "Update Role", value: AVAILABLE_PERMISSIONS.ROLES_UPDATE },
      { key: "ROLES_DELETE", label: "Delete Role", value: AVAILABLE_PERMISSIONS.ROLES_DELETE },
      { key: "BACKUP_EXPORT", label: "Export Backup", value: AVAILABLE_PERMISSIONS.BACKUP_EXPORT },
    ],
  },
];

export const getDefaultPermissionsForRole = (role: UserRole): string[] => {
  const defaults: Record<UserRole, string[]> = {
    superadmin: [], // Has everything by default in middleware
    admin: [
      AVAILABLE_PERMISSIONS.SALES_VIEW,
      AVAILABLE_PERMISSIONS.SALES_CREATE,
      AVAILABLE_PERMISSIONS.SALES_UPDATE,
      AVAILABLE_PERMISSIONS.SALES_CANCEL,
      AVAILABLE_PERMISSIONS.SALES_ADD_PAYMENT,
      AVAILABLE_PERMISSIONS.PRODUCTS_VIEW,
      AVAILABLE_PERMISSIONS.PRODUCTS_CREATE,
      AVAILABLE_PERMISSIONS.PRODUCTS_UPDATE,
      AVAILABLE_PERMISSIONS.PRODUCTS_DELETE,
      AVAILABLE_PERMISSIONS.PURCHASES_VIEW,
      AVAILABLE_PERMISSIONS.PURCHASES_CREATE,
      AVAILABLE_PERMISSIONS.PURCHASES_UPDATE,
      AVAILABLE_PERMISSIONS.PURCHASES_CANCEL,
      AVAILABLE_PERMISSIONS.PURCHASES_ADD_PAYMENT,
      AVAILABLE_PERMISSIONS.EXPENSES_VIEW,
      AVAILABLE_PERMISSIONS.EXPENSES_CREATE,
      AVAILABLE_PERMISSIONS.EXPENSES_UPDATE,
      AVAILABLE_PERMISSIONS.EXPENSES_DELETE,
      AVAILABLE_PERMISSIONS.REPORTS_VIEW,
      AVAILABLE_PERMISSIONS.REPORTS_SALES,
      AVAILABLE_PERMISSIONS.REPORTS_EXPENSES,
      AVAILABLE_PERMISSIONS.REPORTS_PROFIT_LOSS,
      AVAILABLE_PERMISSIONS.OPENING_BALANCE_VIEW,
      AVAILABLE_PERMISSIONS.OPENING_BALANCE_CREATE,
      AVAILABLE_PERMISSIONS.OPENING_BALANCE_UPDATE,
      AVAILABLE_PERMISSIONS.OPENING_BALANCE_DELETE,
      AVAILABLE_PERMISSIONS.CLOSING_BALANCE_VIEW,
      AVAILABLE_PERMISSIONS.CLOSING_BALANCE_CALCULATE,
      AVAILABLE_PERMISSIONS.BANK_ACCOUNTS_VIEW,
      AVAILABLE_PERMISSIONS.BANK_ACCOUNTS_CREATE,
      AVAILABLE_PERMISSIONS.BANK_ACCOUNTS_UPDATE,
      AVAILABLE_PERMISSIONS.BANK_ACCOUNTS_DELETE,
      AVAILABLE_PERMISSIONS.CARDS_VIEW,
      AVAILABLE_PERMISSIONS.CARDS_CREATE,
      AVAILABLE_PERMISSIONS.CARDS_UPDATE,
      AVAILABLE_PERMISSIONS.CARDS_DELETE,
      AVAILABLE_PERMISSIONS.USERS_VIEW,
      AVAILABLE_PERMISSIONS.USERS_CREATE,
      AVAILABLE_PERMISSIONS.USERS_UPDATE,
      AVAILABLE_PERMISSIONS.USERS_DELETE,
      AVAILABLE_PERMISSIONS.SETTINGS_VIEW,
      AVAILABLE_PERMISSIONS.SETTINGS_UPDATE,
      AVAILABLE_PERMISSIONS.ROLES_VIEW,
      AVAILABLE_PERMISSIONS.ROLES_CREATE,
      AVAILABLE_PERMISSIONS.ROLES_UPDATE,
      AVAILABLE_PERMISSIONS.ROLES_DELETE,
      AVAILABLE_PERMISSIONS.BACKUP_EXPORT,
    ],
    cashier: [
      AVAILABLE_PERMISSIONS.SALES_VIEW,
      AVAILABLE_PERMISSIONS.SALES_CREATE,
      AVAILABLE_PERMISSIONS.OPENING_BALANCE_VIEW,
    ],
    warehouse_manager: [
      AVAILABLE_PERMISSIONS.PRODUCTS_VIEW,
      AVAILABLE_PERMISSIONS.PRODUCTS_CREATE,
      AVAILABLE_PERMISSIONS.PRODUCTS_UPDATE,
      AVAILABLE_PERMISSIONS.PURCHASES_VIEW,
      AVAILABLE_PERMISSIONS.PURCHASES_CREATE,
      AVAILABLE_PERMISSIONS.PURCHASES_UPDATE,
      AVAILABLE_PERMISSIONS.OPENING_BALANCE_VIEW,
    ],
  };

  return defaults[role] || [];
};
