import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  User,
  Product,
  Sale,
  SalePayment,
  Expense,
  Purchase,
  PurchasePayment,
  Customer,
  Supplier,
  ShopSettings,
  Category,
  Brand,
} from "../types";
import api from "../services/api";

interface DataContextType {
  // Users
  users: User[];
  usersPagination: { page: number; pageSize: number; total: number; totalPages: number };
  currentUser: User | null;
  loading: boolean;
  error: string | null;
  refreshCurrentUser: () => void;
  login: (username: string, password: string) => Promise<boolean>;
  superAdminLogin: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  addUser: (user: Omit<User, "id" | "createdAt">) => Promise<void>;
  updateUser: (id: string, user: Partial<User>) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  refreshUsers: (page?: number, pageSize?: number) => Promise<void>;

  // Products
  products: Product[];
  productsPagination: { page: number; pageSize: number; total: number; totalPages: number };
  addProduct: (product: Omit<Product, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  updateProduct: (id: string, product: Partial<Product>) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  getProduct: (id: string) => Product | undefined;
  getLowStockProducts: () => Product[];
  refreshProducts: (page?: number, pageSize?: number) => Promise<void>;

  // Sales
  sales: Sale[];
  salesPagination: { page: number; pageSize: number; total: number; totalPages: number };
  addSale: (sale: Omit<Sale, "id" | "createdAt">) => Promise<void>;
  cancelSale: (id: string) => Promise<void>;
  addPaymentToSale: (id: string, payment: SalePayment & { date?: string }) => Promise<void>;
  getSale: (idOrBillNumber: string) => Sale | undefined;
  getSalesByDateRange: (startDate: string, endDate: string) => Sale[];
  refreshSales: (page?: number, pageSize?: number) => Promise<void>;

  // Expenses
  expenses: Expense[];
  expensesPagination: { page: number; pageSize: number; total: number; totalPages: number };
  addExpense: (expense: Omit<Expense, "id" | "createdAt">) => Promise<void>;
  updateExpense: (id: string, expense: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  getExpensesByDateRange: (startDate: string, endDate: string) => Expense[];
  refreshExpenses: (page?: number, pageSize?: number) => Promise<void>;

  // Purchases
  purchases: Purchase[];
  purchasesPagination: { page: number; pageSize: number; total: number; totalPages: number };
  addPurchase: (purchase: Omit<Purchase, "id" | "createdAt">) => Promise<void>;
  updatePurchase: (id: string, purchase: Partial<Purchase>) => Promise<void>;
  addPaymentToPurchase: (id: string, payment: PurchasePayment & { date?: string }) => Promise<void>;
  getPurchasesByDateRange: (startDate: string, endDate: string) => Purchase[];
  refreshPurchases: (page?: number, pageSize?: number) => Promise<void>;

  // Customers
  customers: Customer[];
  addCustomer: (customer: Omit<Customer, "id" | "createdAt" | "totalPurchases" | "dueAmount">) => Promise<void>;
  updateCustomer: (id: string, customer: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;

  // Suppliers
  suppliers: Supplier[];
  addSupplier: (supplier: Omit<Supplier, "id" | "createdAt" | "totalPurchases" | "dueAmount">) => Promise<void>;
  updateSupplier: (id: string, supplier: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;

  // Categories
  categories: Category[];
  addCategory: (category: Omit<Category, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  updateCategory: (id: string, category: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  refreshCategories: () => Promise<void>;

  // Brands
  brands: Brand[];
  addBrand: (brand: Omit<Brand, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  updateBrand: (id: string, brand: Partial<Brand>) => Promise<void>;
  deleteBrand: (id: string) => Promise<void>;
  refreshBrands: () => Promise<void>;

  // Settings
  settings: ShopSettings;
  updateSettings: (settings: Partial<ShopSettings>) => Promise<void>;
  refreshSettings: () => Promise<void>;

  // Bank Accounts
  bankAccounts: any[];
  refreshBankAccounts: () => Promise<void>;
  addBankAccount: (account: any) => Promise<void>;
  updateBankAccount: (id: string, account: Partial<any>) => Promise<void>;
  deleteBankAccount: (id: string) => Promise<void>;
  getDefaultBankAccount: () => Promise<any | null>;

  // Cards
  cards: any[];
  refreshCards: () => Promise<void>;
  addCard: (card: any) => Promise<void>;
  updateCard: (id: string, card: Partial<any>) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  getDefaultCard: () => Promise<any | null>;

  // Backup & Restore
  exportData: () => string;
  importData: (data: string) => Promise<boolean>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const defaultSettings: ShopSettings = {
  shopName: "Isma Sports Complex",
  logo: "/images/logo/logo.png",
  contactNumber: "+92 300 1234567",
  email: "info@ismasports.com",
  address: "Karachi, Pakistan",
  gstNumber: "",
};

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [settings, setSettings] = useState<ShopSettings>(defaultSettings);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingBankAccounts, setLoadingBankAccounts] = useState(false);
  const [loadingCards, setLoadingCards] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  
  // Pagination states
  const [usersPagination, setUsersPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [productsPagination, setProductsPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [salesPagination, setSalesPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [expensesPagination, setExpensesPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [purchasesPagination, setPurchasesPagination] = useState({ page: 1, pageSize: 10, total: 0, totalPages: 1 });

  // Load current user from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    const storedUser = localStorage.getItem("currentUser");
    
    if (token && storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setCurrentUser(user);
      } catch (e) {
        console.error("Error parsing stored user:", e);
        // Clear invalid data
        localStorage.removeItem("authToken");
        localStorage.removeItem("currentUser");
      }
    } else {
      // No token or user, clear everything
      localStorage.removeItem("authToken");
      localStorage.removeItem("currentUser");
    }
  }, []);

  // Load initial data when user is logged in (only once)
  useEffect(() => {
    if (currentUser && !initialDataLoaded) {
      loadInitialData();
      setInitialDataLoaded(true);
    }
  }, [currentUser, initialDataLoaded]);

  const loadInitialData = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    setError(null);
    try {
      // Load data sequentially to avoid multiple simultaneous requests
      // Use default values if pagination state is not initialized
      await refreshProducts(productsPagination?.page || 1, productsPagination?.pageSize || 10);
      await refreshSales(salesPagination?.page || 1, salesPagination?.pageSize || 10);
      await refreshExpenses(expensesPagination?.page || 1, expensesPagination?.pageSize || 10);
      await refreshPurchases(purchasesPagination?.page || 1, purchasesPagination?.pageSize || 10);
      await refreshSettings();
    } catch (err: any) {
      setError(err.message || "Failed to load data");
      console.error("Error loading initial data:", err);
    } finally {
      setLoading(false);
    }
  };

  // User functions
  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.login(username, password);
      setCurrentUser(response.user);
      await loadInitialData();
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || "Login failed");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const superAdminLogin = async (username: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.superAdminLogin(username, password);
      setCurrentUser(response.user);
      await loadInitialData();
      return true;
    } catch (err: any) {
      setError(err.response?.data?.error || "SuperAdmin login failed");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setCurrentUser(null);
      setUsers([]);
      setProducts([]);
      setSales([]);
      setExpenses([]);
      setPurchases([]);
      setCustomers([]);
      setSuppliers([]);
      setSettings(defaultSettings);
      setInitialDataLoaded(false); // Reset so data can be loaded on next login
    }
  };

  const refreshCurrentUser = () => {
    const storedUser = localStorage.getItem("currentUser");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setCurrentUser(user);
      } catch (e) {
        console.error("Error parsing stored user:", e);
      }
    }
  };

  const refreshUsers = async (page?: number, pageSize?: number) => {
    try {
      // Use provided values or fallback to pagination state or defaults
      const currentPage = page !== undefined ? page : (usersPagination?.page || 1);
      const currentPageSize = pageSize !== undefined ? pageSize : (usersPagination?.pageSize || 10);
      console.log("refreshUsers called with:", { page: currentPage, pageSize: currentPageSize });
      const result = await api.getUsers({ page: currentPage, pageSize: currentPageSize });
      console.log("refreshUsers result:", result);
      // Handle both old format (array) and new format ({ data: [...], pagination: {...} })
      if (Array.isArray(result)) {
        setUsers(result);
      } else if (result && result.data) {
        setUsers(result.data);
        if (result.pagination) {
          setUsersPagination(result.pagination);
        }
      } else {
        setUsers([]);
      }
    } catch (err: any) {
      // console.error("refreshUsers error:", err);
      setError(err.response?.data?.error || "Failed to load users");
      throw err;
    }
  };

  const addUser = async (userData: Omit<User, "id" | "createdAt">) => {
    try {
      setError(null);
      const newUser = await api.createUser(userData);
      setUsers([...users, newUser]);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create user");
      throw err;
    }
  };

  const updateUser = async (id: string, userData: Partial<User>) => {
    try {
      setError(null);
      const updatedUser = await api.updateUser(id, userData);
      setUsers(users.map((u) => (u.id === id ? updatedUser : u)));
      
      // If updating own profile, update currentUser
      if (currentUser && id === currentUser.id) {
        setCurrentUser(updatedUser);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update user");
      throw err;
    }
  };

  const deleteUser = async (id: string) => {
    try {
      setError(null);
      await api.deleteUser(id);
      setUsers(users.filter((u) => u.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete user");
      throw err;
    }
  };

  // Product functions
  const refreshProducts = async (page?: number, pageSize?: number) => {
    if (loadingProducts) return; // Prevent duplicate requests
    try {
      setLoadingProducts(true);
      // Use provided values or fallback to pagination state or defaults
      const currentPage = page !== undefined ? page : (productsPagination?.page || 1);
      const currentPageSize = pageSize !== undefined ? pageSize : (productsPagination?.pageSize || 10);
      // console.log("refreshProducts called with:", { page: currentPage, pageSize: currentPageSize });
      const result = await api.getProducts({ page: currentPage, pageSize: currentPageSize });
      // console.log("refreshProducts result:", result);
      // API returns { data: [...], pagination: {...} }
      setProducts(Array.isArray(result.data) ? result.data : []);
      if (result.pagination) {
        setProductsPagination(result.pagination);
      }
    } catch (err: any) {
      // console.error("refreshProducts error:", err);
      setError(err.response?.data?.error || "Failed to load products");
      throw err;
    } finally {
      setLoadingProducts(false);
    }
  };

  const addProduct = async (productData: Omit<Product, "id" | "createdAt" | "updatedAt">) => {
    try {
      setError(null);
      const newProduct = await api.createProduct(productData);
      setProducts([...products, newProduct]);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create product");
      throw err;
    }
  };

  const updateProduct = async (id: string, productData: Partial<Product>) => {
    try {
      setError(null);
      const updatedProduct = await api.updateProduct(id, productData);
      setProducts(products.map((p) => (p.id === id ? updatedProduct : p)));
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update product");
      throw err;
    }
  };

  const deleteProduct = async (id: string) => {
    try {
      setError(null);
      await api.deleteProduct(id);
      setProducts(products.filter((p) => p.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete product");
      throw err;
    }
  };

  const getProduct = (id: string) => {
    return products.find((p) => p.id === id);
  };

  const getLowStockProducts = () => {
    return products.filter((p) => {
      const shopThreshold = (p as any).shopMinStockLevel ?? p.minStockLevel ?? 0;
      const warehouseThreshold = (p as any).warehouseMinStockLevel ?? p.minStockLevel ?? 0;
      return (
        (shopThreshold > 0 && (p.shopQuantity || 0) <= shopThreshold) ||
        (warehouseThreshold > 0 && (p.warehouseQuantity || 0) <= warehouseThreshold)
      );
    });
  };

  // Sale functions
  const refreshSales = async (page?: number, pageSize?: number) => {
    try {
      // Use provided values or fallback to pagination state or defaults
      const currentPage = page !== undefined ? page : (salesPagination?.page || 1);
      const currentPageSize = pageSize !== undefined ? pageSize : (salesPagination?.pageSize || 10);
      console.log("refreshSales called with:", { page: currentPage, pageSize: currentPageSize });
      const result = await api.getSales({ page: currentPage, pageSize: currentPageSize });
      console.log("refreshSales result:", result);
      // API returns { data: [...], pagination: {...} }
      setSales(Array.isArray(result.data) ? result.data : []);
      if (result.pagination) {
        setSalesPagination(result.pagination);
      }
    } catch (err: any) {
      console.error("refreshSales error:", err);
      setError(err.response?.data?.error || "Failed to load sales");
      throw err;
    }
  };

  const addSale = async (saleData: Omit<Sale, "id" | "createdAt">) => {
    try {
      setError(null);
      // Transform sale data for API
      const apiData: any = {
        items: saleData.items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          shopQuantity: (item as any).shopQuantity ?? item.quantity,
          warehouseQuantity: (item as any).warehouseQuantity ?? 0,
          unitPrice: item.unitPrice,
          customPrice: item.customPrice || undefined,
          discount: item.discount || 0,
          discountType: item.discountType || "percent",
          tax: item.tax || 0,
          taxType: item.taxType || "percent",
        })),
        customerName: saleData.customerName,
        customerPhone: saleData.customerPhone,
        customerCity: saleData.customerCity,
        discount: saleData.discount || 0,
        tax: saleData.tax || 0,
        date: saleData.date,
      };
      
      // Use new payments array if available, otherwise fall back to old paymentType
      if (saleData.payments && saleData.payments.length > 0) {
        apiData.payments = saleData.payments;
      } else {
        // Backward compatibility
        apiData.paymentType = saleData.paymentType;
        if (saleData.bankAccountId) {
          apiData.bankAccountId = saleData.bankAccountId;
        }
      }
      
      if (saleData.date) {
        apiData.date = saleData.date;
      }

      const newSale = await api.createSale(apiData);
      setSales([...sales, newSale]);
      await refreshProducts(productsPagination?.page || 1, productsPagination?.pageSize || 10); // Refresh products to update stock
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create sale");
      throw err;
    }
  };

  const cancelSale = async (id: string) => {
    try {
      setError(null);
      const updatedSale = await api.cancelSale(id);
      setSales(sales.map((s) => (s.id === id ? updatedSale : s)));
      await refreshProducts(productsPagination?.page || 1, productsPagination?.pageSize || 10); // Refresh products to update stock
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to cancel sale");
      throw err;
    }
  };

  const addPaymentToSale = async (id: string, payment: SalePayment & { date?: string }) => {
    try {
      setError(null);
      // Ensure amount is provided and valid
      if (payment.amount === undefined || payment.amount === null || payment.amount <= 0) {
        throw new Error("Payment amount must be greater than 0");
      }
      const updatedSale = await api.addPaymentToSale(id, { 
        type: payment.type, 
        amount: payment.amount, 
        bankAccountId: payment.bankAccountId 
      });
      setSales(sales.map((s) => (s.id === id ? updatedSale : s)));
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to add payment");
      throw err;
    }
  };

  const getSale = (idOrBillNumber: string) => {
    return sales.find((s) => s.id === idOrBillNumber || s.billNumber === idOrBillNumber);
  };

  const getSalesByDateRange = (startDate: string, endDate: string) => {
    return sales.filter(
      (s) => s.createdAt >= startDate && s.createdAt <= endDate && s.status === "completed"
    );
  };

  // Expense functions
  const refreshExpenses = async (page?: number, pageSize?: number) => {
    try {
      // Use provided values or fallback to pagination state or defaults
      const currentPage = page !== undefined ? page : (expensesPagination?.page || 1);
      const currentPageSize = pageSize !== undefined ? pageSize : (expensesPagination?.pageSize || 10);
      // console.log("refreshExpenses called with:", { page: currentPage, pageSize: currentPageSize });
      const result = await api.getExpenses({ page: currentPage, pageSize: currentPageSize });
      // console.log("refreshExpenses result:", result);
      // API returns { data: [...], pagination: {...} }
      setExpenses(Array.isArray(result.data) ? result.data : []);
      if (result.pagination) {
        setExpensesPagination(result.pagination);
      }
    } catch (err: any) {
      // console.error("refreshExpenses error:", err);
      setError(err.response?.data?.error || "Failed to load expenses");
      throw err;
    }
  };

  const addExpense = async (expenseData: Omit<Expense, "id" | "createdAt">) => {
    try {
      setError(null);
      const apiData: any = {
        amount: expenseData.amount,
        category: expenseData.category,
        date: expenseData.date,
      };
      if (expenseData.description) {
        apiData.description = expenseData.description;
      }
      if (expenseData.paymentType) {
        apiData.paymentType = expenseData.paymentType;
      }
      if (expenseData.bankAccountId) {
        apiData.bankAccountId = expenseData.bankAccountId;
      }
      await api.createExpense(apiData);
      // Refresh expenses list to get updated data from server
      await refreshExpenses(expensesPagination?.page || 1, expensesPagination?.pageSize || 10);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create expense");
      throw err;
    }
  };

  const updateExpense = async (id: string, expenseData: Partial<Expense>) => {
    try {
      setError(null);
      const apiData: any = {};
      if (expenseData.amount !== undefined) apiData.amount = expenseData.amount;
      if (expenseData.category !== undefined) apiData.category = expenseData.category;
      if (expenseData.description !== undefined) apiData.description = expenseData.description;
      if (expenseData.paymentType !== undefined) apiData.paymentType = expenseData.paymentType;
      if (expenseData.bankAccountId !== undefined) apiData.bankAccountId = expenseData.bankAccountId;
      if (expenseData.date !== undefined) apiData.date = expenseData.date;
      const updatedExpense = await api.updateExpense(id, apiData);
      setExpenses(expenses.map((e) => (e.id === id ? updatedExpense : e)));
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update expense");
      throw err;
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      setError(null);
      await api.deleteExpense(id);
      setExpenses(expenses.filter((e) => e.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete expense");
      throw err;
    }
  };

  const getExpensesByDateRange = (startDate: string, endDate: string) => {
    return expenses.filter((e) => e.date >= startDate && e.date <= endDate);
  };

  // Purchase functions
  const refreshPurchases = async (page?: number, pageSize?: number) => {
    try {
      // Use provided values or fallback to pagination state or defaults
      const currentPage = page !== undefined ? page : (purchasesPagination?.page || 1);
      const currentPageSize = pageSize !== undefined ? pageSize : (purchasesPagination?.pageSize || 10);
      // console.log("refreshPurchases called with:", { page: currentPage, pageSize: currentPageSize });
      const result = await api.getPurchases({ page: currentPage, pageSize: currentPageSize });
      // console.log("refreshPurchases result:", result);
      // API returns { data: [...], pagination: {...} }
      setPurchases(Array.isArray(result.data) ? result.data : []);
      if (result.pagination) {
        setPurchasesPagination(result.pagination);
      }
    } catch (err: any) {
      console.error("refreshPurchases error:", err);
      setError(err.response?.data?.error || "Failed to load purchases");
      throw err;
    }
  };

  const addPurchase = async (purchaseData: Omit<Purchase, "id" | "createdAt">) => {
    try {
      setError(null);
      // Transform purchase data for API
      const apiData = {
        supplierName: purchaseData.supplierName,
        supplierPhone: purchaseData.supplierPhone,
        items: purchaseData.items.map((item) => ({
          productId: item.productId?.trim() || item.productId,
          quantity: item.quantity,
          shopQuantity: (item as any).shopQuantity ?? item.quantity,
          warehouseQuantity: (item as any).warehouseQuantity ?? 0,
          cost: item.cost,
          discount: item.discount || 0,
        })),
        subtotal: purchaseData.subtotal,
        tax: purchaseData.tax || 0,
        total: purchaseData.total,
        payments: purchaseData.payments,
        date: purchaseData.date,
      };

      const newPurchase = await api.createPurchase(apiData);
      setPurchases([...purchases, newPurchase]);
      await refreshProducts(); // Refresh products to update stock
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create purchase");
      throw err;
    }
  };

  const updatePurchase = async (id: string, purchaseData: Partial<Purchase>) => {
    try {
      setError(null);
      const apiData: any = {};
      if (purchaseData.supplierName !== undefined) apiData.supplierName = purchaseData.supplierName;
      if (purchaseData.supplierPhone !== undefined) apiData.supplierPhone = purchaseData.supplierPhone;
      if (purchaseData.items !== undefined) {
        apiData.items = purchaseData.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          shopQuantity: (item as any).shopQuantity ?? item.quantity,
          warehouseQuantity: (item as any).warehouseQuantity ?? 0,
          cost: item.cost,
          discount: item.discount || 0,
        }));
      }
      if (purchaseData.subtotal !== undefined) apiData.subtotal = purchaseData.subtotal;
      if (purchaseData.tax !== undefined) apiData.tax = purchaseData.tax;
      if (purchaseData.total !== undefined) apiData.total = purchaseData.total;
      if (purchaseData.payments !== undefined) apiData.payments = purchaseData.payments;
      if (purchaseData.date !== undefined) apiData.date = purchaseData.date;

      const updatedPurchase = await api.updatePurchase(id, apiData);
      setPurchases(purchases.map((p) => (p.id === id ? updatedPurchase : p)));
      await refreshProducts(productsPagination?.page || 1, productsPagination?.pageSize || 10); // Refresh products to update stock
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update purchase");
      throw err;
    }
  };

  const addPaymentToPurchase = async (id: string, payment: PurchasePayment & { date?: string }) => {
    try {
      setError(null);
      const updatedPurchase = await api.addPaymentToPurchase(id, payment);
      setPurchases(purchases.map((p) => (p.id === id ? updatedPurchase : p)));
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to add payment");
      throw err;
    }
  };

  const getPurchasesByDateRange = (startDate: string, endDate: string) => {
    return purchases.filter((p) => p.date >= startDate && p.date <= endDate);
  };

  // Customer functions (keeping local for now, can be extended later)
  const addCustomer = async (customerData: Omit<Customer, "id" | "createdAt" | "totalPurchases" | "dueAmount">): Promise<void> => {
    const newCustomer: Customer = {
      ...customerData,
      id: Date.now().toString(),
      totalPurchases: 0,
      dueAmount: 0,
      createdAt: new Date().toISOString(),
    };
    setCustomers([...customers, newCustomer]);
  };

  const updateCustomer = async (id: string, customerData: Partial<Customer>): Promise<void> => {
    setCustomers(customers.map((c) => (c.id === id ? { ...c, ...customerData } : c)));
  };

  const deleteCustomer = async (id: string): Promise<void> => {
    setCustomers(customers.filter((c) => c.id !== id));
  };

  // Supplier functions (keeping local for now, can be extended later)
  const addSupplier = async (supplierData: Omit<Supplier, "id" | "createdAt" | "totalPurchases" | "dueAmount">): Promise<void> => {
    const newSupplier: Supplier = {
      ...supplierData,
      id: Date.now().toString(),
      totalPurchases: 0,
      dueAmount: 0,
      createdAt: new Date().toISOString(),
    };
    setSuppliers([...suppliers, newSupplier]);
  };

  const updateSupplier = async (id: string, supplierData: Partial<Supplier>): Promise<void> => {
    setSuppliers(suppliers.map((s) => (s.id === id ? { ...s, ...supplierData } : s)));
  };

  const deleteSupplier = async (id: string): Promise<void> => {
    setSuppliers(suppliers.filter((s) => s.id !== id));
  };

  // Category functions
  const refreshCategories = async () => {
    try {
      const data = await api.getCategories();
      setCategories(data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load categories");
      throw err;
    }
  };

  const addCategory = async (categoryData: Omit<Category, "id" | "createdAt" | "updatedAt">) => {
    try {
      setError(null);
      const newCategory = await api.createCategory(categoryData);
      setCategories([...categories, newCategory]);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create category");
      throw err;
    }
  };

  const updateCategory = async (id: string, categoryData: Partial<Category>) => {
    try {
      setError(null);
      if (!categoryData.name) {
        throw new Error("Category name is required");
      }
      const updatedCategory = await api.updateCategory(id, {
        name: categoryData.name,
        description: categoryData.description,
      });
      setCategories(categories.map((c) => (c.id === id ? updatedCategory : c)));
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update category");
      throw err;
    }
  };

  const deleteCategory = async (id: string) => {
    try {
      setError(null);
      await api.deleteCategory(id);
      setCategories(categories.filter((c) => c.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete category");
      throw err;
    }
  };

  // Brand functions
  const refreshBrands = async () => {
    try {
      const data = await api.getBrands();
      setBrands(data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load brands");
      throw err;
    }
  };

  const addBrand = async (brandData: Omit<Brand, "id" | "createdAt" | "updatedAt">) => {
    try {
      setError(null);
      const newBrand = await api.createBrand(brandData);
      setBrands([...brands, newBrand]);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create brand");
      throw err;
    }
  };

  const updateBrand = async (id: string, brandData: Partial<Brand>) => {
    try {
      setError(null);
      if (!brandData.name) {
        throw new Error("Brand name is required");
      }
      const updatedBrand = await api.updateBrand(id, {
        name: brandData.name,
        description: brandData.description,
      });
      setBrands(brands.map((b) => (b.id === id ? updatedBrand : b)));
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update brand");
      throw err;
    }
  };

  const deleteBrand = async (id: string) => {
    try {
      setError(null);
      await api.deleteBrand(id);
      setBrands(brands.filter((b) => b.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete brand");
      throw err;
    }
  };

  // Settings functions
  const refreshSettings = async () => {
    try {
      const data = await api.getSettings();
      setSettings(data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load settings");
      // Keep default settings on error
    }
  };

  const updateSettings = async (settingsData: Partial<ShopSettings>) => {
    try {
      setError(null);
      const updatedSettings = await api.updateSettings(settingsData);
      setSettings(updatedSettings);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update settings");
      throw err;
    }
  };

  // Backup & Restore
  const exportData = () => {
    const data = {
      users,
      products,
      sales,
      expenses,
      purchases,
      customers,
      suppliers,
      settings,
    };
    return JSON.stringify(data, null, 2);
  };

  const importData = async (dataString: string): Promise<boolean> => {
    try {
      const data = JSON.parse(dataString);
      // This would need backend API support for bulk import
      // For now, just update local state
      if (data.products) setProducts(data.products);
      if (data.sales) setSales(data.sales);
      if (data.expenses) setExpenses(data.expenses);
      if (data.purchases) setPurchases(data.purchases);
      if (data.customers) setCustomers(data.customers);
      if (data.suppliers) setSuppliers(data.suppliers);
      if (data.settings) setSettings(data.settings);
      return true;
    } catch (error) {
      console.error("Error importing data:", error);
      return false;
    }
  };

  // Bank Accounts functions
  const refreshBankAccounts = async () => {
    if (loadingBankAccounts) return; // Prevent duplicate requests
    try {
      setLoadingBankAccounts(true);
      const data = await api.getBankAccounts();
      setBankAccounts(data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load bank accounts");
      throw err;
    } finally {
      setLoadingBankAccounts(false);
    }
  };

  const addBankAccount = async (accountData: any) => {
    try {
      setError(null);
      const newAccount = await api.createBankAccount(accountData);
      setBankAccounts([...bankAccounts, newAccount]);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create bank account");
      throw err;
    }
  };

  const updateBankAccount = async (id: string, accountData: Partial<any>) => {
    try {
      setError(null);
      const updatedAccount = await api.updateBankAccount(id, accountData);
      setBankAccounts(bankAccounts.map((a) => (a.id === id ? updatedAccount : a)));
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update bank account");
      throw err;
    }
  };

  const deleteBankAccount = async (id: string) => {
    try {
      setError(null);
      await api.deleteBankAccount(id);
      setBankAccounts(bankAccounts.filter((a) => a.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete bank account");
      throw err;
    }
  };

  const getDefaultBankAccount = async () => {
    try {
      const account = await api.getDefaultBankAccount();
      return account;
    } catch (err: any) {
      return null;
    }
  };

  // Cards functions
  const refreshCards = async () => {
    if (loadingCards) return; // Prevent duplicate requests
    try {
      setLoadingCards(true);
      const data = await api.getCards();
      setCards(data);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to load cards");
      throw err;
    } finally {
      setLoadingCards(false);
    }
  };

  const addCard = async (cardData: any) => {
    try {
      setError(null);
      const newCard = await api.createCard(cardData);
      setCards([...cards, newCard]);
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to create card");
      throw err;
    }
  };

  const updateCard = async (id: string, cardData: any) => {
    try {
      setError(null);
      const updatedCard = await api.updateCard(id, cardData);
      setCards(cards.map((c) => (c.id === id ? updatedCard : c)));
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to update card");
      throw err;
    }
  };

  const deleteCard = async (id: string) => {
    try {
      setError(null);
      await api.deleteCard(id);
      setCards(cards.filter((c) => c.id !== id));
    } catch (err: any) {
      setError(err.response?.data?.error || "Failed to delete card");
      throw err;
    }
  };

  const getDefaultCard = async () => {
    try {
      const card = await api.getDefaultCard();
      return card;
    } catch (err: any) {
      return null;
    }
  };

  const value: DataContextType = {
    users,
    usersPagination,
    currentUser,
    loading,
    error,
    refreshCurrentUser,
    login,
    superAdminLogin,
    logout,
    addUser,
    updateUser,
    deleteUser,
    refreshUsers,
    products,
    productsPagination,
    addProduct,
    updateProduct,
    deleteProduct,
    getProduct,
    getLowStockProducts,
    refreshProducts,
    sales,
    salesPagination,
    addSale,
    cancelSale,
    addPaymentToSale,
    getSale,
    getSalesByDateRange,
    refreshSales,
    expenses,
    expensesPagination,
    addExpense,
    updateExpense,
    deleteExpense,
    getExpensesByDateRange,
    refreshExpenses,
    purchases,
    purchasesPagination,
    addPurchase,
    updatePurchase,
    addPaymentToPurchase,
    getPurchasesByDateRange,
    refreshPurchases,
    customers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    suppliers,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    categories,
    addCategory,
    updateCategory,
    deleteCategory,
    refreshCategories,
    brands,
    addBrand,
    updateBrand,
    deleteBrand,
    refreshBrands,
    settings,
    updateSettings,
    refreshSettings,
    bankAccounts,
    refreshBankAccounts,
    addBankAccount,
    updateBankAccount,
    deleteBankAccount,
    getDefaultBankAccount,
    cards,
    refreshCards,
    addCard,
    updateCard,
    deleteCard,
    getDefaultCard,
    exportData,
    importData,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error("useData must be used within a DataProvider");
  }
  return context;
};
