import prisma from "../config/database";
import logger from "../utils/logger";
import XLSX from "xlsx";

class BackupService {
  async exportAllData() {
    try {
      // Fetch all data
      const [
        products,
        sales,
        purchases,
        expenses,
        customers,
        suppliers,
        users,
        adminUsers,
        cards,
        bankAccounts,
        categories,
        openingBalances,
        settings,
      ] = await Promise.all([
        prisma.product.findMany({ include: { categoryRef: true } }),
        prisma.sale.findMany({ include: { items: true, customer: true } }),
        prisma.purchase.findMany({ include: { items: true, supplier: true } }),
        prisma.expense.findMany(),
        prisma.customer.findMany(),
        prisma.supplier.findMany(),
        prisma.user.findMany(),
        prisma.adminUser.findMany(),
        prisma.card.findMany(),
        prisma.bankAccount.findMany(),
        prisma.category.findMany(),
        prisma.dailyOpeningBalance.findMany(),
        prisma.shopSettings.findMany(),
      ]);

      // Prepare JSON data
      const exportData = {
        exportDate: new Date().toISOString(),
        version: "1.0.0",
        data: {
          products,
          sales,
          purchases,
          expenses,
          customers,
          suppliers,
          users,
          adminUsers,
          cards,
          bankAccounts,
          categories,
          openingBalances,
          settings,
        },
      };

      // Convert to JSON string with proper formatting
      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      logger.error("Error exporting data:", error);
      throw error;
    }
  }

  async importAllData(importData: any) {
    try {
      // The frontend already extracts the data, so importData should be the data object directly
      // But handle both cases just in case
      const data = importData.data || importData;
      
      // Validate data
      if (!data || typeof data !== 'object') {
        throw new Error("Invalid import data format");
      }
      
      const results: any = {};

      // Import in order: categories, products, customers, suppliers, users, cards, bankAccounts, settings, sales, purchases, expenses, openingBalances
      
      // 1. Categories first (products depend on them)
      if (data.categories && Array.isArray(data.categories)) {
        for (const category of data.categories) {
          try {
            await prisma.category.upsert({
              where: { name: category.name },
              update: {
                description: category.description || null,
              },
              create: {
                name: category.name,
                description: category.description || null,
              },
            });
          } catch (err) {
            logger.warn(`Failed to import category ${category.name}:`, err);
          }
        }
        results.categories = data.categories.length;
      }

      // 2. Products
      if (data.products && Array.isArray(data.products)) {
        for (const product of data.products) {
          try {
            const { id, createdAt, updatedAt, categoryRef, ...productData } = product;
            await prisma.product.upsert({
              where: { id: product.id },
              update: productData,
              create: {
                ...productData,
                id: product.id,
              },
            });
          } catch (err) {
            logger.warn(`Failed to import product ${product.id}:`, err);
          }
        }
        results.products = data.products.length;
      }

      // 3. Customers
      if (data.customers && Array.isArray(data.customers)) {
        for (const customer of data.customers) {
          try {
            const { id, createdAt, ...customerData } = customer;
            await prisma.customer.upsert({
              where: { id: customer.id },
              update: customerData,
              create: {
                ...customerData,
                id: customer.id,
              },
            });
          } catch (err) {
            logger.warn(`Failed to import customer ${customer.id}:`, err);
          }
        }
        results.customers = data.customers.length;
      }

      // 4. Suppliers
      if (data.suppliers && Array.isArray(data.suppliers)) {
        for (const supplier of data.suppliers) {
          try {
            const { id, createdAt, ...supplierData } = supplier;
            await prisma.supplier.upsert({
              where: { id: supplier.id },
              update: supplierData,
              create: {
                ...supplierData,
                id: supplier.id,
              },
            });
          } catch (err) {
            logger.warn(`Failed to import supplier ${supplier.id}:`, err);
          }
        }
        results.suppliers = data.suppliers.length;
      }

      // 5. Users
      if (data.users && Array.isArray(data.users)) {
        for (const user of data.users) {
          try {
            const { id, createdAt, ...userData } = user;
            await prisma.user.upsert({
              where: { id: user.id },
              update: userData,
              create: {
                ...userData,
                id: user.id,
              },
            });
          } catch (err) {
            logger.warn(`Failed to import user ${user.id}:`, err);
          }
        }
        results.users = data.users.length;
      }

      // 6. Cards
      if (data.cards && Array.isArray(data.cards)) {
        for (const card of data.cards) {
          try {
            const { id, createdAt, updatedAt, ...cardData } = card;
            await prisma.card.upsert({
              where: { id: card.id },
              update: cardData,
              create: {
                ...cardData,
                id: card.id,
              },
            });
          } catch (err) {
            logger.warn(`Failed to import card ${card.id}:`, err);
          }
        }
        results.cards = data.cards.length;
      }

      // 7. Bank Accounts
      if (data.bankAccounts && Array.isArray(data.bankAccounts)) {
        for (const account of data.bankAccounts) {
          try {
            const { id, createdAt, updatedAt, ...accountData } = account;
            await prisma.bankAccount.upsert({
              where: { id: account.id },
              update: accountData,
              create: {
                ...accountData,
                id: account.id,
              },
            });
          } catch (err) {
            logger.warn(`Failed to import bank account ${account.id}:`, err);
          }
        }
        results.bankAccounts = data.bankAccounts.length;
      }

      // 8. Settings
      if (data.settings && Array.isArray(data.settings) && data.settings.length > 0) {
        const setting = data.settings[0];
        try {
          const existing = await prisma.shopSettings.findFirst();
          const { id, createdAt, updatedAt, ...settingData } = setting;
          if (existing) {
            await prisma.shopSettings.update({
              where: { id: existing.id },
              data: settingData,
            });
          } else {
            await prisma.shopSettings.create({
              data: settingData,
            });
          }
          results.settings = 1;
        } catch (err) {
          logger.warn(`Failed to import settings:`, err);
        }
      }

      // 9. Sales
      if (data.sales && Array.isArray(data.sales)) {
        for (const sale of data.sales) {
          try {
            const { id, createdAt, items, customer, ...saleData } = sale;
            await prisma.sale.upsert({
              where: { id: sale.id },
              update: saleData,
              create: {
                ...saleData,
                id: sale.id,
                items: {
                  create: items?.map((item: any) => {
                    const { id, ...itemData } = item;
                    return itemData;
                  }) || [],
                },
              },
            });
          } catch (err) {
            logger.warn(`Failed to import sale ${sale.id}:`, err);
          }
        }
        results.sales = data.sales.length;
      }

      // 10. Purchases
      if (data.purchases && Array.isArray(data.purchases)) {
        for (const purchase of data.purchases) {
          try {
            const { id, createdAt, items, supplier, ...purchaseData } = purchase;
            await prisma.purchase.upsert({
              where: { id: purchase.id },
              update: purchaseData,
              create: {
                ...purchaseData,
                id: purchase.id,
                items: {
                  create: items?.map((item: any) => {
                    const { id, ...itemData } = item;
                    return itemData;
                  }) || [],
                },
              },
            });
          } catch (err) {
            logger.warn(`Failed to import purchase ${purchase.id}:`, err);
          }
        }
        results.purchases = data.purchases.length;
      }

      // 11. Expenses
      if (data.expenses && Array.isArray(data.expenses)) {
        for (const expense of data.expenses) {
          try {
            const { id, createdAt, ...expenseData } = expense;
            await prisma.expense.upsert({
              where: { id: expense.id },
              update: expenseData,
              create: {
                ...expenseData,
                id: expense.id,
              },
            });
          } catch (err) {
            logger.warn(`Failed to import expense ${expense.id}:`, err);
          }
        }
        results.expenses = data.expenses.length;
      }

      // 12. Opening Balances
      if (data.openingBalances && Array.isArray(data.openingBalances)) {
        for (const balance of data.openingBalances) {
          try {
            const { id, createdAt, ...balanceData } = balance;
            await prisma.dailyOpeningBalance.upsert({
              where: { id: balance.id },
              update: balanceData,
              create: {
                ...balanceData,
                id: balance.id,
              },
            });
          } catch (err) {
            logger.warn(`Failed to import opening balance ${balance.id}:`, err);
          }
        }
        results.openingBalances = data.openingBalances.length;
      }

      return results;
    } catch (error) {
      logger.error("Error importing data:", error);
      throw error;
    }
  }

  async exportReportToExcel(
    reportData: {
      sales?: any[];
      expenses?: any[];
      summary?: any;
      dateRange?: { start: string; end: string };
    }
  ) {
    try {
      const workbook = XLSX.utils.book_new();

      // Summary sheet
      if (reportData.summary) {
        const summaryData = [
          ["Report Summary"],
          ["Date Range", `${reportData.dateRange?.start || ""} to ${reportData.dateRange?.end || ""}`],
          ...Object.entries(reportData.summary).map(([key, value]) => [
            key,
            typeof value === "number" ? value.toFixed(2) : value,
          ]),
        ];
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
      }

      // Sales sheet
      if (reportData.sales && reportData.sales.length > 0) {
        const salesData = reportData.sales.map((sale) => ({
          "Bill Number": sale.billNumber || "",
          Date: sale.date ? new Date(sale.date).toLocaleDateString() : "",
          "Customer Name": sale.customerName || "Walk-in",
          "Customer Phone": sale.customerPhone || "",
          Subtotal: Number(sale.subtotal || 0).toFixed(2),
          Discount: Number(sale.discount || 0).toFixed(2),
          Tax: Number(sale.tax || 0).toFixed(2),
          Total: Number(sale.total || 0).toFixed(2),
          "Payment Type": sale.paymentType || "",
          Status: sale.status || "",
        }));
        const salesSheet = XLSX.utils.json_to_sheet(salesData);
        XLSX.utils.book_append_sheet(workbook, salesSheet, "Sales");
      }

      // Expenses sheet
      if (reportData.expenses && reportData.expenses.length > 0) {
        const expensesData = reportData.expenses.map((expense) => ({
          Date: expense.date ? new Date(expense.date).toLocaleDateString() : "",
          Category: expense.category || "",
          Description: expense.description || "",
          Amount: Number(expense.amount || 0).toFixed(2),
          "Payment Type": expense.paymentType || "",
        }));
        const expensesSheet = XLSX.utils.json_to_sheet(expensesData);
        XLSX.utils.book_append_sheet(workbook, expensesSheet, "Expenses");
      }

      const excelBuffer = XLSX.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      });

      return excelBuffer;
    } catch (error) {
      logger.error("Error exporting report to Excel:", error);
      throw error;
    }
  }
}

export default new BackupService();






