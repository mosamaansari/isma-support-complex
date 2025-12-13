import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import logger from "./utils/logger";
import redis from "./config/redis";
import prisma from "./config/database";

// Import routes
import authRoutes from "./routes/auth.routes";
import productsRoutes from "./routes/products.routes";
import salesRoutes from "./routes/sales.routes";
import expensesRoutes from "./routes/expenses.routes";
import purchasesRoutes from "./routes/purchases.routes";
import reportsRoutes from "./routes/reports.routes";
import usersRoutes from "./routes/users.routes";
import settingsRoutes from "./routes/settings.routes";
import categoriesRoutes from "./routes/categories.routes";
import rolesRoutes from "./routes/roles.routes";
import cardsRoutes from "./routes/cards.routes";
import bankAccountsRoutes from "./routes/bankAccounts.routes";
import openingBalanceRoutes from "./routes/openingBalance.routes";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 6000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined", {
  stream: {
    write: (message: string) => logger.info(message.trim()),
  },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api/", limiter);

// Health check
app.get("/health", async (req: Request, res: Response) => {
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
app.get("/", (req: Request, res: Response) => {
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
      roles: "/api/roles",
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
app.use("/api/roles", rolesRoutes);
app.use("/api/cards", cardsRoutes);
app.use("/api/bank-accounts", bankAccountsRoutes);
app.use("/api/opening-balances", openingBalanceRoutes);

// 404 handler
app.use((req: Request, res: Response) => {
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
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT signal received: closing HTTP server");
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(0);
});

