import 'dotenv/config';
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import logger from "../utils/logger";

// Validate and fix DATABASE_URL if needed
let databaseUrl = process.env.DATABASE_URL;
console.log("databaseUrl", databaseUrl);
if (!databaseUrl) {
  logger.error("DATABASE_URL is not set in environment variables");
  throw new Error("DATABASE_URL environment variable is required");
}

// Log connection info (without exposing password)
try {
  const urlObj = new URL(databaseUrl);
  logger.info(`Database: ${urlObj.protocol}//${urlObj.hostname}:${urlObj.port || 'default'}${urlObj.pathname}`);
} catch (e) {
  logger.warn("Could not parse DATABASE_URL for logging");
}

// Ensure DATABASE_URL is a string
if (typeof databaseUrl !== "string") {
  logger.error("DATABASE_URL must be a string");
  throw new Error("DATABASE_URL must be a string");
}

// Parse DATABASE_URL and ensure password is handled correctly
let pool: Pool;
let adapter: PrismaPg;

try {
  // Remove quotes if present (dotenv might include them)
  databaseUrl = databaseUrl.trim().replace(/^["']|["']$/g, '');
  
  // Normalize postgresql:// to postgres:// for URL parsing
  const normalizedUrl = databaseUrl.replace(/^postgresql:\/\//, 'postgres://');
  const url = new URL(normalizedUrl);
  
  // Extract connection parameters
  const poolConfig: any = {
    user: url.username || undefined,
    host: url.hostname || undefined,
    port: url.port ? parseInt(url.port) : 5432,
    database: url.pathname ? url.pathname.slice(1) : undefined,
  };
  
  // Handle password - ensure it's always a string (never undefined or null)
  // PostgreSQL requires password to be a string type for SASL authentication
  if (url.password !== null && url.password !== undefined && url.password !== "") {
    poolConfig.password = url.password;
  } else {
    // If password is empty or missing, set to empty string (not undefined)
    poolConfig.password = "";
  }
  
  // Handle SSL mode from query params
  const sslMode = url.searchParams.get("sslmode");
  if (sslMode === "require" || sslMode === "prefer") {
    poolConfig.ssl = { rejectUnauthorized: false };
  }
  
  // Use individual config to ensure password is always a string
  pool = new Pool(poolConfig);
  adapter = new PrismaPg(pool);
} catch (error) {
  logger.error("Failed to parse DATABASE_URL, using connection string:", error);
  // Fallback to connection string
  pool = new Pool({
    connectionString: databaseUrl,
  });
  adapter = new PrismaPg(pool);
}

const prisma = new PrismaClient({
  // @ts-ignore - adapter type compatibility
  adapter,
  log: [
    { level: "query", emit: "event" },
    { level: "error", emit: "event" },
    { level: "warn", emit: "event" },
  ],
});

// Log database queries in development
if (process.env.NODE_ENV === "development") {
  prisma.$on("query" as never, (e: any) => {
    logger.debug("Query: " + e.query);
    logger.debug("Params: " + e.params);
    logger.debug("Duration: " + e.duration + "ms");
  });
}

prisma.$on("error" as never, (e: any) => {
  logger.error("Prisma error:", e);
});

prisma.$on("warn" as never, (e: any) => {
  logger.warn("Prisma warning:", e);
});

// Graceful shutdown
process.on("beforeExit", async () => {
  await prisma.$disconnect();
  logger.info("Database disconnected");
});

export default prisma;
