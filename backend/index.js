const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

// Import routes (handle ES6 default exports compiled to CommonJS)
const getRoute = (module) => module.default || module;
const authRoutes = getRoute(require("./dist/routes/auth.routes"));
const productsRoutes = getRoute(require("./dist/routes/products.routes"));
const salesRoutes = getRoute(require("./dist/routes/sales.routes"));
const expensesRoutes = getRoute(require("./dist/routes/expenses.routes"));
const purchasesRoutes = getRoute(require("./dist/routes/purchases.routes"));
const reportsRoutes = getRoute(require("./dist/routes/reports.routes"));
const usersRoutes = getRoute(require("./dist/routes/users.routes"));
const settingsRoutes = getRoute(require("./dist/routes/settings.routes"));
const categoriesRoutes = getRoute(require("./dist/routes/categories.routes"));
const rolesRoutes = getRoute(require("./dist/routes/roles.routes"));
const cardsRoutes = getRoute(require("./dist/routes/cards.routes"));
const bankAccountsRoutes = getRoute(require("./dist/routes/bankAccounts.routes"));
const searchRoutes = getRoute(require("./dist/routes/search.routes"));
const dashboardRoutes = getRoute(require("./dist/routes/dashboard.routes"));
const backupRoutes = getRoute(require("./dist/routes/backup.routes"));

const app = express();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// Logging middleware (skip in production for Vercel)
if (process.env.NODE_ENV !== "production") {
  app.use(
    morgan("combined", {
      stream: {
        write: (message) => console.log(message.trim()),
      },
    })
  );
}

// Rate limiting
// const limiter = rateLimit({
//   windowMs: 1 * 60 * 1000, // 1 minutes
//   max: 500, // limit each IP to 500 requests per windowMs
//   message: "Too many requests from this IP, please try again later.",
// });
// app.use("/api/", limiter);

// Health check
app.get("/health", async (req, res) => {
  try {
    const prisma = getRoute(require("./dist/config/database"));
    
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Check Redis connection (optional, might fail in serverless)
    try {
      const redis = getRoute(require("./dist/config/redis"));
      await redis.ping();
    } catch (redisError) {
      // Redis might not be available in serverless
      console.warn("Redis ping failed (optional):", redisError);
    }

    res.json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Health check failed:", error);
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
      cards: "/api/cards",
      bankAccounts: "/api/bank-accounts",
      search: "/api/search",
      dashboard: "/api/dashboard",
      backup: "/api/backup",
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
app.use("/api/search", searchRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/backup", backupRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// Export for Vercel
module.exports = app;

