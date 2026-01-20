import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import logger from "./src/utils/logger";
import redis from "./src/config/redis";
import prisma from "./src/config/database";


// Import routes
import authRoutes from "./src/routes/auth.routes";
import productsRoutes from "./src/routes/products.routes";
import salesRoutes from "./src/routes/sales.routes";
import expensesRoutes from "./src/routes/expenses.routes";
import purchasesRoutes from "./src/routes/purchases.routes";
import reportsRoutes from "./src/routes/reports.routes";
import usersRoutes from "./src/routes/users.routes";
import settingsRoutes from "./src/routes/settings.routes";
import categoriesRoutes from "./src/routes/categories.routes";
import brandsRoutes from "./src/routes/brands.routes";
import rolesRoutes from "./src/routes/roles.routes";
import cardsRoutes from "./src/routes/cards.routes";
import bankAccountsRoutes from "./src/routes/bankAccounts.routes";
import openingBalanceRoutes from "./src/routes/openingBalance.routes";
import dailyConfirmationRoutes from "./src/routes/dailyConfirmation.routes";
import balanceTransactionRoutes from "./src/routes/balanceTransaction.routes";
import dailyClosingBalanceRoutes from "./src/routes/dailyClosingBalance.routes";
import searchRoutes from "./src/routes/search.routes";
import dashboardRoutes from "./src/routes/dashboard.routes";
import backupRoutes from "./src/routes/backup.routes";
import suppliersRoutes from "./src/routes/suppliers.routes";
import cronService from "./src/services/cron.service";


// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(morgan("combined", {
  stream: {
    write: (message: string) => logger.info(message.trim()),
  },
}));

// Rate limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000, // 15 minutes
//   max: 100, // limit each IP to 100 requests per windowMs
//   message: "Too many requests from this IP, please try again later.",
// });
// app.use("/api/", limiter);

// Health check
app.get("/health", async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Check Redis connection
    await redis.ping();

    res.json({
      status: "ok",
      database: "connected",
      redis: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Health check failed:", error);
    res.status(503).json({
      status: "error",
      message: "Service unavailable",
    });
  }
});

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "Isma Sports Complex API",
    version: "1.0.0",
    status: "running",
    endpoints: {
      health: "/health",
      auth: "/api/auth",
      products: "/api/products",
      sales: "/api/sales",
      expenses: "/api/expenses",
      purchases: "/api/purchases",
      reports: "/api/reports",
      users: "/api/users",
      settings: "/api/settings",
      categories: "/api/categories",
      brands: "/api/brands",
      roles: "/api/roles",
      cards: "/api/cards",
      bankAccounts: "/api/bank-accounts",
      search: "/api/search",
      dashboard: "/api/dashboard",
      backup: "/api/backup",
      suppliers: "/api/suppliers",
      openingBalances: "/api/opening-balances",
      dailyConfirmation: "/api/daily-confirmation",
      balanceTransactions: "/api/balance-transactions",
      dailyClosingBalance: "/api/daily-closing-balance",
    },
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/expenses", expensesRoutes);
app.use("/api/purchases", purchasesRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/brands", brandsRoutes);
app.use("/api/roles", rolesRoutes);
app.use("/api/cards", cardsRoutes);
app.use("/api/bank-accounts", bankAccountsRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/backup", backupRoutes);
app.use("/api/suppliers", suppliersRoutes);
app.use("/api/opening-balances", openingBalanceRoutes);
app.use("/api/daily-confirmation", dailyConfirmationRoutes);
app.use("/api/balance-transactions", balanceTransactionRoutes);
app.use("/api/daily-closing-balance", dailyClosingBalanceRoutes);


// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
  
  // Start cron service for automated tasks
  try {
    cronService.start();
    logger.info("Cron service initialized and started");
  } catch (error) {
    logger.error("Failed to start cron service:", error);
  }
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  cronService.stop();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT signal received: closing HTTP server");
  cronService.stop();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
});


