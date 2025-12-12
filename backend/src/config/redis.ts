import Redis from "ioredis";
import logger from "../utils/logger";

// For Vercel/Upstash Redis support
const redisConfig: any = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD || undefined,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

// Upstash Redis uses TLS on port 6380
if (process.env.REDIS_PORT === "6380" || process.env.REDIS_TLS === "true") {
  redisConfig.tls = {};
}

const redis = new Redis(redisConfig);

redis.on("connect", () => {
  logger.info("Redis connected successfully");
});

redis.on("error", (err) => {
  logger.error("Redis connection error:", err);
  // Don't throw - allow app to continue without Redis in serverless
});

export default redis;

