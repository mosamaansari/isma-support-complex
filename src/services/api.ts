import axios, { AxiosInstance, AxiosError } from "axios";
import { normalizeProduct, normalizeSale, normalizeExpense, normalizePurchase } from "../utils/apiHelpers";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

class ApiClient {
  private client: AxiosInstance;
  private pendingRequests: Map<string, Promise<any>> = new Map();

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use(
      (config) => {
        try {
        const token = localStorage.getItem("authToken");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
          // console.log("API Request:", config.method?.toUpperCase(), config.url, config.params || config.data || "");
          return config;
        } catch (err) {
          console.error("Error in request interceptor:", err);
        return config;
        }
      },
      (error) => {
        console.error("Request interceptor error:", error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => {
        try {
          // Transform response to handle new format { message, response, error }
          // Only transform if response has the new format structure
          if (response.data && 
              typeof response.data === 'object' && 
              response.data.response !== undefined &&
              response.data.response !== null &&
              (response.data.message !== undefined || response.data.error !== undefined)) {
            // For list endpoints, response.response contains { data: [...], pagination: {...} }
            // For single item endpoints, response.response contains { data: item }
            // Extract the response object which contains the actual data
            // console.log("Transforming response:", response.config?.url, response.data);
            return { ...response, data: response.data.response };
        }
          // For old format or auth endpoints, return as is
          // console.log("Returning response as is:", response.config?.url);
          return response;
        } catch (err) {
          console.error("Error in response interceptor:", err, response.config?.url);
          return response;
        }
      },
      (error: AxiosError) => {
        // console.error("API Error:", error.response?.status, error.config?.url, error.message);
        if (error.response?.status === 401) {
          // Don't redirect if it's a login endpoint or password update endpoint (let the form handle the error)
          const url = error.config?.url || "";
          if (!url.includes("/auth/login") && 
              !url.includes("/auth/superadmin/login") &&
              !url.includes("/users/profile/password")) {
            // Unauthorized - clear token and redirect to login
            localStorage.removeItem("authToken");
            localStorage.removeItem("currentUser");
            window.location.href = "/login";
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Request deduplication helper
  private async deduplicateRequest<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
    // If request is already pending, return the existing promise
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key)!;
    }

    // Create new request
    const promise = requestFn().finally(() => {
      // Remove from pending requests when done
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  // Auth endpoints
  async login(username: string, password: string) {
    const response = await this.client.post("/auth/login", { username, password });
    // Auth endpoints return { token, user } directly, not wrapped in { message, response, error }
    const data = response.data?.response?.data || response.data;
    if (data?.token) {
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("currentUser", JSON.stringify(data.user));
    }
    return data || response.data;
  }

  async superAdminLogin(username: string, password: string) {
    const response = await this.client.post("/auth/superadmin/login", {
      username,
      password,
    });
    // Auth endpoints return { token, user } directly, not wrapped in { message, response, error }
    const data = response.data?.response?.data || response.data;
    if (data?.token) {
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("currentUser", JSON.stringify(data.user));
    }
    return data || response.data;
  }

  async logout() {
    try {
    await this.client.post("/auth/logout");
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
    localStorage.removeItem("authToken");
    localStorage.removeItem("currentUser");
    }
  }

  async forgotPassword(email: string, userType: "user" | "admin" = "user") {
    const response = await this.client.post("/auth/forgot-password", { email, userType });
    return response.data;
  }

  async resetPassword(token: string, newPassword: string, userType: "user" | "admin" = "user") {
    const response = await this.client.post("/auth/reset-password", { token, newPassword, userType });
    return response.data;
  }

  // Products endpoints
  async getProducts(params?: { search?: string; category?: string; lowStock?: boolean; page?: number; pageSize?: number }) {
    const key = `getProducts-${JSON.stringify(params)}`;
    return this.deduplicateRequest(key, async () => {
      const response = await this.client.get("/products", { params });
      if (response.data && response.data.data && response.data.pagination) {
        return {
          data: Array.isArray(response.data.data)
            ? response.data.data.map(normalizeProduct)
            : [],
          pagination: response.data.pagination,
        };
      }
      // Fallback for old format
      return {
        data: Array.isArray(response.data)
          ? response.data.map(normalizeProduct)
          : [],
        pagination: {
          page: 1,
          pageSize: response.data.length || 10,
          total: response.data.length || 0,
          totalPages: 1,
        },
      };
    });
  }

  async getProduct(id: string) {
    const response = await this.client.get(`/products/${id}`);
    return normalizeProduct(response.data);
  }

  async createProduct(data: any) {
    const response = await this.client.post("/products", data);
    // Response is already transformed by interceptor
    const product = response.data?.data || response.data;
    return normalizeProduct(product);
  }

  async updateProduct(id: string, data: any) {
    const response = await this.client.put(`/products/${id}`, data);
    // Response is already transformed by interceptor
    const product = response.data?.data || response.data;
    return normalizeProduct(product);
  }

  async deleteProduct(id: string) {
    await this.client.delete(`/products/${id}`);
  }

  async getLowStockProducts() {
    const response = await this.client.get("/products/inventory/low-stock");
    return response.data;
  }

  // Search endpoints
  async globalSearch(query: string) {
    if (!query || query.trim().length < 2) {
      return { results: [] };
    }
    const response = await this.client.get("/search", { params: { q: query.trim() } });
    return response.data;
  }

  // Sales endpoints
  async getSales(params?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const key = `getSales-${JSON.stringify(params)}`;
    return this.deduplicateRequest(key, async () => {
      const response = await this.client.get("/sales", { params });
      if (response.data && response.data.data && response.data.pagination) {
        return {
          data: Array.isArray(response.data.data)
            ? response.data.data.map(normalizeSale)
            : [],
          pagination: response.data.pagination,
        };
      }
      // Fallback for old format
      return {
        data: Array.isArray(response.data)
          ? response.data.map(normalizeSale)
          : [],
        pagination: {
          page: 1,
          pageSize: response.data.length || 10,
          total: response.data.length || 0,
          totalPages: 1,
        },
      };
    });
  }

  async getSale(id: string) {
    const response = await this.client.get(`/sales/${id}`);
    return normalizeSale(response.data);
  }

  async getSaleByBillNumber(billNumber: string) {
    const response = await this.client.get(`/sales/bill/${billNumber}`);
    // Response is already transformed by interceptor
    const sale = response.data?.data || response.data;
    return normalizeSale(sale);
  }

  async createSale(data: any) {
    const response = await this.client.post("/sales", data);
    // Response is already transformed by interceptor
    const sale = response.data?.data || response.data;
    return normalizeSale(sale);
  }

  async cancelSale(id: string, refundData?: { refundMethod: "cash" | "bank_transfer" | "card"; bankAccountId?: string; cardId?: string }) {
    const response = await this.client.patch(`/sales/${id}/cancel`, refundData || {});
    // Response is already transformed by interceptor
    const sale = response.data?.data || response.data;
    return normalizeSale(sale);
  }

  async addPaymentToSale(saleId: string, payment: { type: string; amount: number; cardId?: string; bankAccountId?: string; date?: string }) {
    const response = await this.client.post(`/sales/${saleId}/payments`, payment);
    // Response is already transformed by interceptor
    const sale = response.data?.data || response.data;
    return normalizeSale(sale);
  }

  // Expenses endpoints
  async getExpenses(params?: {
    startDate?: string;
    endDate?: string;
    category?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) {
    const key = `getExpenses-${JSON.stringify(params)}`;
    return this.deduplicateRequest(key, async () => {
      const response = await this.client.get("/expenses", { params });
      if (response.data && response.data.data && response.data.pagination) {
        return {
          data: Array.isArray(response.data.data)
            ? response.data.data.map(normalizeExpense)
            : [],
          pagination: response.data.pagination,
          summary: response.data.summary || null,
        };
      }
      // Fallback for old format
      return {
        data: Array.isArray(response.data)
          ? response.data.map(normalizeExpense)
          : [],
        pagination: {
          page: 1,
          pageSize: response.data.length || 10,
          total: response.data.length || 0,
          totalPages: 1,
        },
        summary: null,
      };
    });
  }

  async getExpense(id: string) {
    const response = await this.client.get(`/expenses/${id}`);
    // Response is already transformed by interceptor
    const expense = response.data?.data || response.data;
    return normalizeExpense(expense);
  }

  async createExpense(data: any) {
    const response = await this.client.post("/expenses", data);
    // Response is already transformed by interceptor
    const expense = response.data?.data || response.data;
    return normalizeExpense(expense);
  }

  async updateExpense(id: string, data: any) {
    const response = await this.client.put(`/expenses/${id}`, data);
    // Response is already transformed by interceptor
    const expense = response.data?.data || response.data;
    return normalizeExpense(expense);
  }

  async deleteExpense(id: string) {
    await this.client.delete(`/expenses/${id}`);
  }

  async getExpenseStatistics() {
    const response = await this.client.get("/expenses/statistics/all-time");
    // Response is already transformed by interceptor
    if (response.data?.data) {
      return response.data.data;
    }
    return response.data;
  }

  // Purchases endpoints
  async getPurchases(params?: {
    startDate?: string;
    endDate?: string;
    supplierId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const response = await this.client.get("/purchases", { params });
    if (response.data && response.data.data && response.data.pagination) {
      return {
        data: Array.isArray(response.data.data)
          ? response.data.data.map(normalizePurchase)
          : [],
        pagination: response.data.pagination,
      };
    }
    // Fallback for old format
    return {
      data: Array.isArray(response.data)
        ? response.data.map(normalizePurchase)
        : [],
      pagination: {
        page: 1,
        pageSize: response.data.length || 10,
        total: response.data.length || 0,
        totalPages: 1,
      },
    };
  }

  async createPurchase(data: any) {
    const response = await this.client.post("/purchases", data);
    // Response is already transformed by interceptor
    const purchase = response.data?.data || response.data;
    return normalizePurchase(purchase);
  }

  async getPurchase(id: string) {
    const response = await this.client.get(`/purchases/${id}`);
    // Response is already transformed by interceptor
    const purchase = response.data?.data || response.data;
    return normalizePurchase(purchase);
  }

  async updatePurchase(id: string, data: any) {
    const response = await this.client.put(`/purchases/${id}`, data);
    // Response is already transformed by interceptor
    const purchase = response.data?.data || response.data;
    return normalizePurchase(purchase);
  }

  async cancelPurchase(id: string, refundData?: { refundMethod: "cash" | "bank_transfer" | "card"; bankAccountId?: string; cardId?: string }) {
    const response = await this.client.patch(`/purchases/${id}/cancel`, refundData || {});
    // Response is already transformed by interceptor
    const purchase = response.data?.data || response.data;
    return normalizePurchase(purchase);
  }

  async addPaymentToPurchase(id: string, payment: any) {
    const response = await this.client.post(`/purchases/${id}/payments`, payment);
    // Response is already transformed by interceptor
    const purchase = response.data?.data || response.data;
    return normalizePurchase(purchase);
  }

  // Opening Balance endpoints
  async getOpeningBalance(date: string) {
    const response = await this.client.get("/opening-balances/date", { params: { date } });
    return response.data;
  }

  /** Get STORED opening balance for a date from DailyOpeningBalance table only (no running calc). Returns null if no record. */
  async getStoredOpeningBalance(date: string) {
    const response = await this.client.get("/opening-balances/date", { params: { date, storedOnly: "true" } });
    return response.data;
  }

  async getOpeningBalances(params?: { startDate?: string; endDate?: string }) {
    const response = await this.client.get("/opening-balances", { params });
    return response.data;
  }

  async createOpeningBalance(data: any) {
    const response = await this.client.post("/opening-balances", data);
    return response.data;
  }

  async updateOpeningBalance(id: string, data: any) {
    const response = await this.client.put(`/opening-balances/${id}`, data);
    return response.data;
  }

  async deleteOpeningBalance(id: string) {
    await this.client.delete(`/opening-balances/${id}`);
  }

  // Suppliers endpoints
  async getSuppliers(search?: string) {
    const response = await this.client.get("/suppliers", { params: { search } });
    // Support both {response:{data}} and {data}
    if (response.data?.response?.data) return response.data.response.data;
    if (response.data?.data) return response.data.data;
    return response.data || [];
  }

  // Reports endpoints
  async getDailyReport(date: string) {
    const response = await this.client.get("/reports/daily", { params: { date } });
    return response.data;
  }

  async generateDailyReportPDF(date: string) {
    const response = await this.client.get("/reports/daily/pdf", { 
      params: { date },
      responseType: "blob"
    });
    return response.data;
  }

  async getDateRangeReport(startDate: string, endDate: string) {
    const response = await this.client.get("/reports/range", { params: { startDate, endDate } });
    return response.data;
  }

  async getDashboardStats() {
    const response = await this.client.get("/dashboard");
    return response.data;
  }

  async getSalesReport(params?: { startDate?: string; endDate?: string }) {
    const response = await this.client.get("/reports/sales", { params });
    return response.data;
  }

  async getExpensesReport(params?: { startDate?: string; endDate?: string }) {
    const response = await this.client.get("/reports/expenses", { params });
    return response.data;
  }

  async getProfitLossReport(params?: { startDate?: string; endDate?: string }) {
    const response = await this.client.get("/reports/profit-loss", { params });
    return response.data;
  }

  // Users endpoints
  async getUsers(params?: { page?: number; pageSize?: number }) {
    const response = await this.client.get("/users", { params });
    // Response is already transformed by interceptor
    // For list endpoints, it's { data: [...], pagination: {...} }
    if (response.data && response.data.data && response.data.pagination) {
      return {
        data: Array.isArray(response.data.data) ? response.data.data : [],
        pagination: response.data.pagination,
      };
    }
    // Fallback for old format
    if (Array.isArray(response.data)) {
      return {
        data: response.data,
        pagination: {
          page: 1,
          pageSize: response.data.length || 10,
          total: response.data.length || 0,
          totalPages: 1,
        },
      };
    }
    return {
      data: response.data?.data || [],
      pagination: response.data?.pagination || {
        page: 1,
        pageSize: 10,
        total: 0,
        totalPages: 1,
      },
    };
  }

  async getUser(id: string) {
    const response = await this.client.get(`/users/${id}`);
    // Response is already transformed by interceptor
    const user = response.data?.data || response.data;
    return user;
  }

  async createUser(data: any) {
    const response = await this.client.post("/users", data);
    // Response is already transformed by interceptor
    const user = response.data?.data || response.data;
    return user;
  }

  async updateUser(id: string, data: any) {
    // If updating own profile, use /profile endpoint
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    if (id === currentUser.id) {
      const response = await this.client.put("/users/profile", data);
      // Response is already transformed by interceptor
      const user = response.data?.data || response.data;
      // Update currentUser in localStorage
      if (user) {
        localStorage.setItem("currentUser", JSON.stringify(user));
      }
      return user;
    }
    // Otherwise use admin endpoint
    const response = await this.client.put(`/users/${id}`, data);
    // Response is already transformed by interceptor
    const user = response.data?.data || response.data;
    return user;
  }

  async updateProfile(data: { name: string; email?: string; profilePicture?: string }) {
    const response = await this.client.put("/users/profile", data);
    const user = response.data?.response?.data || response.data?.data || response.data;
    // Update currentUser in localStorage
    if (user) {
      localStorage.setItem("currentUser", JSON.stringify(user));
    }
    return user;
  }

  async updatePassword(data: { currentPassword: string; newPassword: string; confirmPassword: string }) {
    const response = await this.client.put("/users/profile/password", data);
    return response.data?.response?.data || response.data;
  }

  async deleteUser(id: string) {
    await this.client.delete(`/users/${id}`);
  }

  // Categories endpoints
  async getCategories() {
    const response = await this.client.get("/categories");
    // Response is already transformed by interceptor
    return response.data?.data || response.data;
  }

  async getCategory(id: string) {
    const response = await this.client.get(`/categories/${id}`);
    // Response is already transformed by interceptor
    return response.data?.data || response.data;
  }

  async createCategory(data: { name: string; description?: string }) {
    const response = await this.client.post("/categories", data);
    // Response is already transformed by interceptor
    return response.data?.data || response.data;
  }

  async updateCategory(id: string, data: { name: string; description?: string }) {
    const response = await this.client.put(`/categories/${id}`, data);
    // Response is already transformed by interceptor
    return response.data?.data || response.data;
  }

  async deleteCategory(id: string) {
    await this.client.delete(`/categories/${id}`);
  }

  // Brand endpoints
  async getBrands() {
    const response = await this.client.get("/brands");
    // Response is already transformed by interceptor
    return response.data?.data || response.data;
  }

  async getBrand(id: string) {
    const response = await this.client.get(`/brands/${id}`);
    // Response is already transformed by interceptor
    return response.data?.data || response.data;
  }

  async createBrand(data: { name: string; description?: string }) {
    const response = await this.client.post("/brands", data);
    // Response is already transformed by interceptor
    return response.data?.data || response.data;
  }

  async updateBrand(id: string, data: { name: string; description?: string }) {
    const response = await this.client.put(`/brands/${id}`, data);
    // Response is already transformed by interceptor
    return response.data?.data || response.data;
  }

  async deleteBrand(id: string) {
    await this.client.delete(`/brands/${id}`);
  }

  // Settings endpoints
  async getSettings() {
    return this.deduplicateRequest("getSettings", async () => {
      const response = await this.client.get("/settings");
      return response.data?.response?.data || response.data?.data || response.data;
    });
  }

  async updateSettings(data: any) {
    const response = await this.client.put("/settings", { data });
    return response.data?.response?.data || response.data;
  }

  // Bank Accounts endpoints
  async getBankAccounts() {
    return this.deduplicateRequest("getBankAccounts", async () => {
      const response = await this.client.get("/bank-accounts");
      // Response is already transformed by interceptor
      return response.data?.data || response.data;
    });
  }

  async getBankAccount(id: string) {
    const response = await this.client.get(`/bank-accounts/${id}`);
    // Response is already transformed by interceptor
    return response.data?.data || response.data;
  }

  async getDefaultBankAccount() {
    const response = await this.client.get("/bank-accounts/default");
    // Response is already transformed by interceptor
    return response.data?.data || response.data;
  }

  async createBankAccount(data: any) {
    const response = await this.client.post("/bank-accounts", data);
    // Response is already transformed by interceptor
    return response.data?.data || response.data;
  }

  async updateBankAccount(id: string, data: any) {
    const response = await this.client.put(`/bank-accounts/${id}`, data);
    // Response is already transformed by interceptor
    return response.data?.data || response.data;
  }

  async deleteBankAccount(id: string) {
    await this.client.delete(`/bank-accounts/${id}`);
  }

  // Cards endpoints
  async getCards() {
    return this.deduplicateRequest("getCards", async () => {
      const response = await this.client.get("/cards");
      // Response is already transformed by interceptor
      return response.data?.data || response.data;
    });
  }

  async getCard(id: string) {
    const response = await this.client.get(`/cards/${id}`);
    // Response is already transformed by interceptor
    return response.data?.data || response.data;
  }

  async getDefaultCard() {
    const response = await this.client.get("/cards/default");
    // Response is already transformed by interceptor
    return response.data?.data || response.data;
  }

  async createCard(data: any) {
    const response = await this.client.post("/cards", data);
    // Response is already transformed by interceptor
    return response.data?.data || response.data;
  }

  async updateCard(id: string, data: any) {
    const response = await this.client.put(`/cards/${id}`, data);
    // Response is already transformed by interceptor
    return response.data?.data || response.data;
  }

  async deleteCard(id: string) {
    await this.client.delete(`/cards/${id}`);
  }

  // Reports PDF export
  async exportSalesReportPDF(params?: { startDate?: string; endDate?: string }) {
    const response = await this.client.get("/reports/sales/export-pdf", {
      params,
      responseType: "blob",
    });
    return response.data;
  }

  async exportExpensesReportPDF(params?: { startDate?: string; endDate?: string }) {
    const response = await this.client.get("/reports/expenses/export-pdf", {
      params,
      responseType: "blob",
    });
    return response.data;
  }

  async exportProfitLossReportPDF(params?: { startDate?: string; endDate?: string }) {
    const response = await this.client.get("/reports/profit-loss/export-pdf", {
      params,
      responseType: "blob",
    });
    return response.data;
  }

  async exportReportToExcel(reportData: any) {
    const response = await this.client.post("/backup/report/excel", reportData, {
      responseType: "blob",
    });
    return response.data;
  }

  async exportAllData() {
    const response = await this.client.get("/backup/export-all-excel", {
      responseType: "text",
    });
    return response.data;
  }

  async importAllData(data: any) {
    const response = await this.client.post("/backup/import-all", data);
    return response.data?.response?.data || response.data;
  }

  // Roles endpoints
  async getRoles() {
    const response = await this.client.get("/roles");
    return response.data?.response?.data || response.data || [];
  }

  async createRole(data: { name: string; label: string; description?: string }) {
    const response = await this.client.post("/roles", data);
    // Handle nested response structure
    if (response.data?.response?.data) {
      return response.data.response.data;
    }
    if (response.data?.data) {
      return response.data.data;
    }
    return response.data;
  }

  async updateRole(id: string, data: { label?: string; description?: string; isActive?: boolean }) {
    const response = await this.client.put(`/roles/${id}`, data);
    return response.data?.response?.data || response.data;
  }

  async deleteRole(id: string) {
    const response = await this.client.delete(`/roles/${id}`);
    return response.data?.response?.data || response.data;
  }

  // Daily Confirmation endpoints
  async checkDailyConfirmation() {
    const response = await this.client.get("/daily-confirmation/check");
    return response.data?.response || response.data;
  }

  async confirmDaily() {
    const response = await this.client.post("/daily-confirmation/confirm");
    return response.data?.response || response.data;
  }

  // Enhanced Opening Balance endpoints
  async createOpeningBalanceWithBanks(data: {
    date: string;
    cashBalance: number;
    bankBalances?: Array<{ bankAccountId: string; balance: number }>;
    notes?: string;
  }) {
    const response = await this.client.post("/opening-balances", data);
    return response.data?.response?.data || response.data;
  }

  async updateOpeningBalanceWithBanks(id: string, data: {
    cashBalance?: number;
    bankBalances?: Array<{ bankAccountId: string; balance: number }>;
    notes?: string;
  }) {
    const response = await this.client.put(`/opening-balances/${id}`, data);
    return response.data?.response?.data || response.data;
  }

  async addToOpeningBalance(data: {
    date: string;
    amount: number;
    type: "cash" | "bank";
    bankAccountId?: string;
    description?: string;
  }) {
    const response = await this.client.post("/opening-balances/add", data);
    return response.data?.response?.data || response.data;
  }

  // Balance Transaction endpoints
  async getCashTransactions(startDate?: string, endDate?: string, excludeRefunds: boolean = false) {
    const response = await this.client.get("/balance-transactions/cash", {
      params: { startDate, endDate, excludeRefunds },
    });
    // After interceptor, response.data is response.response, which contains { data: [...] }
    return response.data?.data || response.data || [];
  }

  async getBankTransactions(bankAccountId: string, startDate?: string, endDate?: string, excludeRefunds: boolean = false) {
    const response = await this.client.get("/balance-transactions/bank", {
      params: { bankAccountId, startDate, endDate, excludeRefunds },
    });
    // After interceptor, response.data is response.response, which contains { data: [...] }
    return response.data?.data || response.data || [];
  }

  async getAllTransactionsGroupedByDay(startDate?: string, endDate?: string, excludeRefunds: boolean = false) {
    const response = await this.client.get("/balance-transactions/grouped", {
      params: { startDate, endDate, excludeRefunds },
    });
    // After interceptor, response.data is response.response, which contains { data: [...] }
    return response.data?.data || response.data || [];
  }

  async getCurrentBankBalance(bankAccountId: string) {
    const response = await this.client.get("/balance-transactions/bank-balance", {
      params: { bankAccountId },
    });
    return response.data?.response || response.data;
  }

  async getCurrentCardBalance(cardId: string) {
    const response = await this.client.get("/balance-transactions/card-balance", {
      params: { cardId },
    });
    return response.data?.response || response.data;
  }

  // Daily Closing Balance endpoints
  async getClosingBalance(date: string) {
    const response = await this.client.get("/daily-closing-balance", {
      params: { date },
    });
    return response.data?.response || response.data;
  }

  async getPreviousDayClosingBalance(date: string) {
    const response = await this.client.get("/daily-closing-balance/previous", {
      params: { date },
    });
    return response.data?.response || response.data;
  }

  async getClosingBalances(startDate: string, endDate: string) {
    const response = await this.client.get("/daily-closing-balance/range", {
      params: { startDate, endDate },
    });
    return response.data?.response || response.data;
  }

  async getTransactions(params?: {
    startDate?: string;
    endDate?: string;
    paymentType?: "cash" | "bank_transfer";
    bankAccountId?: string;
    type?: "income" | "expense";
  }) {
    const response = await this.client.get("/balance-transactions", { params });
    return response.data?.response?.data || response.data;
  }
}

export const api = new ApiClient();
export default api;

