// User Types
export type UserRole = "superadmin" | "admin" | "cashier" | "warehouse_manager";

export interface User {
  id: string;
  username: string;
  password: string;
  role: UserRole;
  name: string;
  email?: string;
  profilePicture?: string; // Profile picture URL or base64
  permissions?: string[]; // Array of allowed page paths
  userType?: "user" | "admin"; // Type to distinguish regular users from admin users
  createdAt: string;
}

// Product Types
export interface Product {
  id: string;
  name: string;
  category?: string;
  salePrice?: number;
  shopQuantity: number;
  warehouseQuantity: number;
  shopMinStockLevel: number;
  warehouseMinStockLevel: number;
  minStockLevel: number;
  lowStockNotifiedAt?: string | null;
  model?: string;
  manufacturer?: string;
  barcode?: string;
  image?: string; // Product image URL
  createdAt: string;
  updatedAt: string;
}

// Sales Types
export type PaymentType = "cash" | "bank_transfer";

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  shopQuantity?: number;
  warehouseQuantity?: number;
  fromWarehouse?: boolean;
  unitPrice: number;
  customPrice?: number; // Custom price for this customer
  discount: number;
  discountType?: "percent" | "value"; // Discount type: percent or direct value
  tax: number;
  taxType?: "percent" | "value"; // Tax type: percent or direct value
  total: number;
}

export interface SalePayment {
  type: "cash" | "bank_transfer";
  amount: number;
  bankAccountId?: string;
}

export interface Sale {
  id: string;
  billNumber: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentType: PaymentType;
  payments?: SalePayment[];
  remainingBalance?: number;
  bankAccountId?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerCity?: string;
  date?: string;
  userId: string;
  userName: string;
  createdAt: string;
  status: "completed" | "pending" | "cancelled";
}

// Expense Types
export type ExpenseCategory =
  | "rent"
  | "bills"
  | "transport"
  | "salaries"
  | "maintenance"
  | "marketing"
  | "other";

export interface Expense {
  id: string;
  amount: number;
  category: ExpenseCategory;
  description: string | null;
  paymentType?: PaymentType;
  bankAccountId?: string;
  date: string;
  userId: string;
  userName: string;
  createdAt: string;
}

// Purchase Types
export interface PurchaseItem {
  productId: string;
  productName: string;
  quantity: number;
  shopQuantity?: number;
  warehouseQuantity?: number;
  cost: number;
  discount?: number;
  total: number;
  toWarehouse?: boolean;
}

export interface PurchasePayment {
  type: "cash" | "bank_transfer";
  amount: number;
  bankAccountId?: string;
  date?: string;
}

export interface Purchase {
  id: string;
  supplierName: string;
  supplierPhone?: string;
  items: PurchaseItem[];
  subtotal: number;
  tax: number;
  total: number;
  payments: PurchasePayment[];
  remainingBalance: number;
  status: "completed" | "pending" | "cancelled";
  date: string;
  userId: string;
  userName: string;
  createdAt: string;
}

// Opening Balance Types
export interface CardBalance {
  cardId: string;
  balance: number;
}

export interface DailyOpeningBalance {
  id: string;
  date: string;
  cashBalance: number;
  cardBalances: CardBalance[];
  notes?: string;
  userId: string;
  userName: string;
  createdAt: string;
  updatedAt: string;
}

// Report Types
export interface DailyReport {
  date: string;
  openingBalance: {
    cash: number;
    cards: Array<{ cardId: string; cardName: string; balance: number }>;
    total: number;
  };
  sales: {
    total: number;
    cash: number;
    card: number;
    credit: number;
    count: number;
    items: Sale[];
  };
  purchases: {
    total: number;
    cash: number;
    card: number;
    count: number;
    items: Purchase[];
  };
  expenses: {
    total: number;
    cash: number;
    card: number;
    count: number;
    items: Expense[];
  };
  closingBalance: {
    cash: number;
    cards: Array<{ cardId: string; cardName: string; balance: number }>;
    total: number;
  };
}

export interface DateRangeReport {
  startDate: string;
  endDate: string;
  summary: {
    openingBalance: {
      cash: number;
      cards: number;
      total: number;
    };
    sales: {
      total: number;
      cash: number;
      card: number;
      credit: number;
      count: number;
    };
    purchases: {
      total: number;
      cash: number;
      card: number;
      count: number;
    };
    expenses: {
      total: number;
      cash: number;
      card: number;
      count: number;
    };
    closingBalance: {
      cash: number;
      cards: number;
      total: number;
    };
  };
  dailyReports: DailyReport[];
  sales: Sale[];
  purchases: Purchase[];
  expenses: Expense[];
}

// Customer Types
export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  totalPurchases: number;
  dueAmount: number;
  createdAt: string;
}

// Supplier Types
export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  totalPurchases: number;
  dueAmount: number;
  createdAt: string;
}

// Category Types
export interface Category {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// Settings Types
export interface ShopSettings {
  shopName: string;
  logo: string;
  contactNumber: string;
  email: string;
  address: string;
  gstNumber?: string;
}

