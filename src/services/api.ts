import axios, { AxiosInstance, AxiosError } from "axios";
import { normalizeProduct, normalizeSale, normalizeExpense } from "../utils/apiHelpers";

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
        const token = localStorage.getItem("authToken");
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem("authToken");
          localStorage.removeItem("currentUser");
          window.location.href = "/signin";
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
    if (response.data.token) {
      localStorage.setItem("authToken", response.data.token);
      localStorage.setItem("currentUser", JSON.stringify(response.data.user));
    }
    return response.data;
  }

  async superAdminLogin(username: string, password: string) {
    const response = await this.client.post("/auth/superadmin/login", {
      username,
      password,
    });
    if (response.data.token) {
      localStorage.setItem("authToken", response.data.token);
      localStorage.setItem("currentUser", JSON.stringify(response.data.user));
    }
    return response.data;
  }

  async logout() {
    await this.client.post("/auth/logout");
    localStorage.removeItem("authToken");
    localStorage.removeItem("currentUser");
  }

  // Products endpoints
  async getProducts(params?: { search?: string; category?: string; lowStock?: boolean }) {
    const key = `getProducts-${JSON.stringify(params)}`;
    return this.deduplicateRequest(key, async () => {
      const response = await this.client.get("/products", { params });
      // Convert backend Decimal types to numbers
      return Array.isArray(response.data) 
        ? response.data.map(normalizeProduct)
        : [];
    });
  }

  async getProduct(id: string) {
    const response = await this.client.get(`/products/${id}`);
    return normalizeProduct(response.data);
  }

  async createProduct(data: any) {
    const response = await this.client.post("/products", data);
    return normalizeProduct(response.data);
  }

  async updateProduct(id: string, data: any) {
    const response = await this.client.put(`/products/${id}`, data);
    return normalizeProduct(response.data);
  }

  async deleteProduct(id: string) {
    await this.client.delete(`/products/${id}`);
  }

  async getLowStockProducts() {
    const response = await this.client.get("/products/inventory/low-stock");
    return response.data;
  }

  // Sales endpoints
  async getSales(params?: {
    startDate?: string;
    endDate?: string;
    status?: string;
    search?: string;
  }) {
    const key = `getSales-${JSON.stringify(params)}`;
    return this.deduplicateRequest(key, async () => {
      const response = await this.client.get("/sales", { params });
      return Array.isArray(response.data)
        ? response.data.map(normalizeSale)
        : [];
    });
  }

  async getSale(id: string) {
    const response = await this.client.get(`/sales/${id}`);
    return normalizeSale(response.data);
  }

  async getSaleByBillNumber(billNumber: string) {
    const response = await this.client.get(`/sales/bill/${billNumber}`);
    return normalizeSale(response.data);
  }

  async createSale(data: any) {
    const response = await this.client.post("/sales", data);
    return normalizeSale(response.data);
  }

  async cancelSale(id: string) {
    const response = await this.client.patch(`/sales/${id}/cancel`);
    return normalizeSale(response.data);
  }

  async addPaymentToSale(saleId: string, payment: { type: string; amount: number; cardId?: string; bankAccountId?: string }) {
    const response = await this.client.post(`/sales/${saleId}/payments`, payment);
    return normalizeSale(response.data);
  }

  // Expenses endpoints
  async getExpenses(params?: {
    startDate?: string;
    endDate?: string;
    category?: string;
    search?: string;
  }) {
    const key = `getExpenses-${JSON.stringify(params)}`;
    return this.deduplicateRequest(key, async () => {
      const response = await this.client.get("/expenses", { params });
      return Array.isArray(response.data)
        ? response.data.map(normalizeExpense)
        : [];
    });
  }

  async getExpense(id: string) {
    const response = await this.client.get(`/expenses/${id}`);
    return normalizeExpense(response.data);
  }

  async createExpense(data: any) {
    const response = await this.client.post("/expenses", data);
    return normalizeExpense(response.data);
  }

  async updateExpense(id: string, data: any) {
    const response = await this.client.put(`/expenses/${id}`, data);
    return normalizeExpense(response.data);
  }

  async deleteExpense(id: string) {
    await this.client.delete(`/expenses/${id}`);
  }

  // Purchases endpoints
  async getPurchases(params?: {
    startDate?: string;
    endDate?: string;
    supplierId?: string;
  }) {
    const response = await this.client.get("/purchases", { params });
    return response.data;
  }

  async createPurchase(data: any) {
    const response = await this.client.post("/purchases", data);
    return response.data;
  }

  async getPurchase(id: string) {
    const response = await this.client.get(`/purchases/${id}`);
    return response.data;
  }

  async updatePurchase(id: string, data: any) {
    const response = await this.client.put(`/purchases/${id}`, data);
    return response.data;
  }

  async addPaymentToPurchase(id: string, payment: any) {
    const response = await this.client.post(`/purchases/${id}/payments`, payment);
    return response.data;
  }

  // Opening Balance endpoints
  async getOpeningBalance(date: string) {
    const response = await this.client.get("/opening-balances/date", { params: { date } });
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

  // Reports endpoints
  async getDailyReport(date: string) {
    const response = await this.client.get("/reports/daily", { params: { date } });
    return response.data;
  }

  async getDateRangeReport(startDate: string, endDate: string) {
    const response = await this.client.get("/reports/range", { params: { startDate, endDate } });
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
  async getUsers() {
    const response = await this.client.get("/users");
    return response.data;
  }

  async getUser(id: string) {
    const response = await this.client.get(`/users/${id}`);
    return response.data;
  }

  async createUser(data: any) {
    const response = await this.client.post("/users", data);
    return response.data;
  }

  async updateUser(id: string, data: any) {
    // If updating own profile, use /profile endpoint
    const currentUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
    if (id === currentUser.id) {
      const response = await this.client.put("/users/profile", data);
      // Update currentUser in localStorage
      if (response.data) {
        localStorage.setItem("currentUser", JSON.stringify(response.data));
      }
      return response.data;
    }
    // Otherwise use admin endpoint
    const response = await this.client.put(`/users/${id}`, data);
    return response.data;
  }

  async deleteUser(id: string) {
    await this.client.delete(`/users/${id}`);
  }

  // Categories endpoints
  async getCategories() {
    const response = await this.client.get("/categories");
    return response.data;
  }

  async getCategory(id: string) {
    const response = await this.client.get(`/categories/${id}`);
    return response.data;
  }

  async createCategory(data: { name: string; description?: string }) {
    const response = await this.client.post("/categories", data);
    return response.data;
  }

  async updateCategory(id: string, data: { name: string; description?: string }) {
    const response = await this.client.put(`/categories/${id}`, data);
    return response.data;
  }

  async deleteCategory(id: string) {
    await this.client.delete(`/categories/${id}`);
  }

  // Roles endpoints
  async getRoles() {
    const response = await this.client.get("/roles");
    return response.data;
  }

  // Settings endpoints
  async getSettings() {
    return this.deduplicateRequest("getSettings", async () => {
      const response = await this.client.get("/settings");
      return response.data;
    });
  }

  async updateSettings(data: any) {
    const response = await this.client.put("/settings", data);
    return response.data;
  }

  // Bank Accounts endpoints
  async getBankAccounts() {
    return this.deduplicateRequest("getBankAccounts", async () => {
      const response = await this.client.get("/bank-accounts");
      return response.data;
    });
  }

  async getBankAccount(id: string) {
    const response = await this.client.get(`/bank-accounts/${id}`);
    return response.data;
  }

  async getDefaultBankAccount() {
    const response = await this.client.get("/bank-accounts/default");
    return response.data;
  }

  async createBankAccount(data: any) {
    const response = await this.client.post("/bank-accounts", data);
    return response.data;
  }

  async updateBankAccount(id: string, data: any) {
    const response = await this.client.put(`/bank-accounts/${id}`, data);
    return response.data;
  }

  async deleteBankAccount(id: string) {
    await this.client.delete(`/bank-accounts/${id}`);
  }

  // Cards endpoints
  async getCards() {
    return this.deduplicateRequest("getCards", async () => {
      const response = await this.client.get("/cards");
      return response.data;
    });
  }

  async getCard(id: string) {
    const response = await this.client.get(`/cards/${id}`);
    return response.data;
  }

  async getDefaultCard() {
    const response = await this.client.get("/cards/default");
    return response.data;
  }

  async createCard(data: any) {
    const response = await this.client.post("/cards", data);
    return response.data;
  }

  async updateCard(id: string, data: any) {
    const response = await this.client.put(`/cards/${id}`, data);
    return response.data;
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
}

export const api = new ApiClient();
export default api;

