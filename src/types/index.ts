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
  createdAt: string;
}

// Product Types
export interface Product {
  id: string;
  name: string;
  category: string;
  cost: number;
  salePrice: number;
  quantity: number;
  minStockLevel: number;
  barcode?: string;
  image?: string; // Product image URL
  createdAt: string;
  updatedAt: string;
}

// Sales Types
export type PaymentType = "cash" | "credit";

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  total: number;
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
  customerName?: string;
  customerPhone?: string;
  userId: string;
  userName: string;
  createdAt: string;
  status: "completed" | "cancelled";
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
  description: string;
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
  cost: number;
  total: number;
}

export interface Purchase {
  id: string;
  supplierName: string;
  items: PurchaseItem[];
  total: number;
  date: string;
  userId: string;
  userName: string;
  createdAt: string;
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
  bankAccountNumber: string;
  bankName: string;
  ifscCode: string;
  gstNumber?: string;
}

