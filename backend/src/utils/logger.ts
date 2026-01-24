import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import path from "path";
import fs from "fs";

// Check if file logging is disabled via environment variable (default: disabled to save disk space)
const DISABLE_FILE_LOGGING = process.env.DISABLE_FILE_LOGGING !== "false" && process.env.DISABLE_FILE_LOGGING !== "0";
const isVercel = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

// Create logs directory if it doesn't exist (only if file logging is enabled and not on Vercel/Production)
const logsDir = path.join(process.cwd(), "logs");
if (!DISABLE_FILE_LOGGING && !isVercel && !fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format for development/production
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

const transports = [];

// Only add file transports if file logging is enabled and not on Vercel
if (!DISABLE_FILE_LOGGING && !isVercel) {
  // Use File transports in Development
  transports.push(
    // Write all logs to combined.log
    new DailyRotateFile({
      filename: path.join(logsDir, "combined-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxSize: "20m",
      maxFiles: "14d",
    }),
    // Write errors to error.log
    new DailyRotateFile({
      filename: path.join(logsDir, "error-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxSize: "20m",
      maxFiles: "30d",
    })
  );
}

// Always add console transport (for both dev and production)
transports.push(
  new winston.transports.Console({
    format: consoleFormat,
  })
);

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  defaultMeta: { service: "isma-sports-complex-api" },
  transports: transports,
});

export default logger;


