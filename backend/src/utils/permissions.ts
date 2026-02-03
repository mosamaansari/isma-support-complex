// Permission constants for backend routes
export const PERMISSIONS = {
  // Sales
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

  // Daily Confirmation (Removed separate permissions as per user request)

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

  // Wildcards for full module access
  SALES_ALL: "sales:*",
  PRODUCTS_ALL: "products:*",
  PURCHASES_ALL: "purchases:*",
  EXPENSES_ALL: "expenses:*",
  ACCOUNTS_ALL: "accounts:*",
  FINANCE_ALL: "finance:*",
  REPORTS_ALL: "reports:*",
  USERS_ALL: "users:*",
  SETTINGS_ALL: "settings:*",
  CLOSING_BALANCE_ALL: "closing_balance:*",
} as const;
