import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger";

const prisma = new PrismaClient({
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


