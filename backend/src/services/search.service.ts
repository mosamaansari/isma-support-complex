import prisma from "../config/database";
import logger from "../utils/logger";

interface SearchResult {
  type: "product" | "sale" | "purchase" | "expense" | "customer" | "user";
  id: string;
  title: string;
  subtitle?: string;
  url: string;
}

class SearchService {
  async globalSearch(query: string, userPermissions: string[] = [], userRole: string = ""): Promise<SearchResult[]> {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const searchTerm = query.trim();
    const results: SearchResult[] = [];

    // Check if user can search products
    const canSearchProducts = 
      userRole === "superadmin" || 
      userRole === "admin" ||
      userPermissions.some(p => p.includes("/inventory/products") || p.includes("INVENTORY_VIEW"));

    // Check if user can search sales
    const canSearchSales = 
      userRole === "superadmin" || 
      userRole === "admin" ||
      userPermissions.some(p => p.includes("/sales") || p.includes("SALES_VIEW"));

    // Check if user can search purchases
    const canSearchPurchases = 
      userRole === "superadmin" || 
      userRole === "admin" ||
      userPermissions.some(p => p.includes("/inventory/purchases") || p.includes("PURCHASE_VIEW"));

    // Check if user can search expenses
    const canSearchExpenses = 
      userRole === "superadmin" || 
      userRole === "admin" ||
      userPermissions.some(p => p.includes("/expenses") || p.includes("EXPENSES_VIEW"));

    // Check if user can search users
    const canSearchUsers = 
      userRole === "superadmin" || 
      userRole === "admin" ||
      userPermissions.some(p => p.includes("/users") || p.includes("USERS_VIEW"));

    try {
      // Search Products
      if (canSearchProducts) {
        const products = await prisma.product.findMany({
          where: {
            OR: [
              { name: { contains: searchTerm, mode: "insensitive" } },
              { category: { contains: searchTerm, mode: "insensitive" } },
              { barcode: { contains: searchTerm, mode: "insensitive" } },
            ],
          },
          take: 5,
          orderBy: { createdAt: "desc" },
        });

        products.forEach((product) => {
          results.push({
            type: "product",
            id: product.id,
            title: product.name,
            subtitle: `Category: ${product.category || "N/A"} | Stock: ${(product.shopQuantity || 0) + (product.warehouseQuantity || 0)}`,
            url: `/inventory/product/edit/${product.id}`,
          });
        });
      }

      // Search Sales
      if (canSearchSales) {
        const sales = await prisma.sale.findMany({
          where: {
            OR: [
              { billNumber: { contains: searchTerm, mode: "insensitive" } },
              { customerName: { contains: searchTerm, mode: "insensitive" } },
              { customerPhone: { contains: searchTerm } },
            ],
          },
          take: 5,
          orderBy: { createdAt: "desc" },
        });

        sales.forEach((sale) => {
          results.push({
            type: "sale",
            id: sale.id,
            title: `Bill #${sale.billNumber}`,
            subtitle: `Customer: ${sale.customerName || "Walk-in"} | Amount: Rs. ${Number(sale.total).toFixed(2)}`,
            url: `/sales/bill/${sale.billNumber}`,
          });
        });
      }

      // Search Purchases
      if (canSearchPurchases) {
        const purchases = await prisma.purchase.findMany({
          where: {
            OR: [
              { supplierName: { contains: searchTerm, mode: "insensitive" } },
              { supplierPhone: { contains: searchTerm } },
            ],
          },
          take: 5,
          orderBy: { createdAt: "desc" },
        });

        purchases.forEach((purchase) => {
          results.push({
            type: "purchase",
            id: purchase.id,
            title: `Purchase #${purchase.id.slice(0, 8)}`,
            subtitle: `Supplier: ${purchase.supplierName} | Amount: Rs. ${Number(purchase.total).toFixed(2)}`,
            url: `/inventory/purchase/view/${purchase.id}`,
          });
        });
      }

      // Search Expenses
      if (canSearchExpenses) {
        const expenses = await prisma.expense.findMany({
          where: {
            OR: [
              { description: { contains: searchTerm, mode: "insensitive" } },
            ],
          },
          take: 5,
          orderBy: { date: "desc" },
        });

        expenses.forEach((expense) => {
          results.push({
            type: "expense",
            id: expense.id,
            title: expense.description,
            subtitle: `Category: ${expense.category} | Amount: Rs. ${Number(expense.amount).toFixed(2)}`,
            url: `/expenses/edit/${expense.id}`,
          });
        });
      }

      // Search Users (only for admin/superadmin)
      if (canSearchUsers) {
        const users = await prisma.user.findMany({
          where: {
            OR: [
              { name: { contains: searchTerm, mode: "insensitive" } },
              { username: { contains: searchTerm, mode: "insensitive" } },
              { email: { contains: searchTerm, mode: "insensitive" } },
            ],
          },
          take: 5,
          orderBy: { createdAt: "desc" },
        });

        users.forEach((user) => {
          results.push({
            type: "user",
            id: user.id,
            title: user.name,
            subtitle: `Username: ${user.username} | Role: ${user.role}`,
            url: `/users/edit/${user.id}`,
          });
        });
      }

      return results;
    } catch (error: any) {
      logger.error("Global search error:", error);
      return [];
    }
  }
}

export default new SearchService();

