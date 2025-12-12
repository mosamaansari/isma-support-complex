import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import logger from "../backend/src/utils/logger";
import redis from "../backend/src/config/redis";
import prisma from "../backend/src/config/database";

// Import routes
import authRoutes from "../backend/src/routes/auth.routes";
import productsRoutes from "../backend/src/routes/products.routes";
import salesRoutes from "../backend/src/routes/sales.routes";
import expensesRoutes from "../backend/src/routes/expenses.routes";
import purchasesRoutes from "../backend/src/routes/purchases.routes";
import reportsRoutes from "../backend/src/routes/reports.routes";
import usersRoutes from "../backend/src/routes/users.routes";
import settingsRoutes from "../backend/src/routes/settings.routes";
import categoriesRoutes from "../backend/src/routes/categories.routes";
import rolesRoutes from "../backend/src/routes/roles.routes";

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "*",
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware (skip in production for Vercel)
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("combined", {
    stream: {
      write: (message: string) => logger.info(message.trim()),
    },
  }));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api/", limiter);

// Health check
app.get("/health", async (req, res) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Check Redis connection (optional, might fail in serverless)
    try {
      await redis.ping();
    } catch (redisError) {
      // Redis might not be available in serverless
      logger.warn("Redis ping failed (optional):", redisError);
    }

    res.json({
      status: "ok",
      database: "connected",
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

// Vercel serverless function handler
// Export Express app directly - Vercel automatically handles Express apps
export default app;

