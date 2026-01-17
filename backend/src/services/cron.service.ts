import * as cron from "node-cron";
import logger from "../utils/logger";
import prisma from "../config/database";
import dailyClosingBalanceService from "./dailyClosingBalance.service";
import openingBalanceService from "./openingBalance.service";
import { formatLocalYMD, parseLocalYMD, getTodayInPakistan } from "../utils/date";

/**
 * Cron service to automatically handle daily tasks:
 * 1. Calculate and store previous day's closing balance
 * 2. Create today's opening balance from previous day's closing balance
 * 
 * Runs daily at 12:00 AM (midnight)
 */
class CronService {
  private cronJob: cron.ScheduledTask | null = null;

  /**
   * Start the cron job
   * Runs daily at 12:00 AM (midnight) to handle previous day's closing and current day's opening
   */
  start() {
    // Run every day at 12:00 AM (midnight) Pakistan time
    this.cronJob = cron.schedule("0 0 * * *", async () => {
      try {
        const cronStartTime = new Date();
        logger.info(`Cron job started at ${cronStartTime.toISOString()} (Pakistan time: ${getTodayInPakistan().toISOString()}): Calculating previous day closing balance and creating today's opening balance`);
        
        // Step 1: Calculate and store previous day's closing balance
        // Use Pakistan timezone to get yesterday's date
        const today = getTodayInPakistan();
        const todayStr = formatLocalYMD(today);
        // Parse date string to get components and create at noon (12:00:00)
        const [year, month, day] = todayStr.split("-").map(v => parseInt(v, 10));
        const yesterday = new Date(year, month - 1, day, 12, 0, 0, 0);
        yesterday.setDate(yesterday.getDate() - 1); // Get previous day
        const yesterdayStr = formatLocalYMD(yesterday);
        
        logger.info(`Calculating closing balance for previous day: ${yesterdayStr}`);
        try {
          await dailyClosingBalanceService.calculateAndStoreClosingBalance(yesterday);
          logger.info(`Successfully calculated and stored closing balance for ${yesterdayStr} at ${new Date().toISOString()}`);
        } catch (error: any) {
          logger.error(`Error calculating closing balance for ${yesterdayStr}:`, error);
          // Don't throw - continue to opening balance creation
        }
        
        // Step 2: Create today's opening balance from previous day's closing
        logger.info(`Creating opening balance for today: ${todayStr}`);
        await this.autoCreateOpeningBalanceFromPreviousDay();
        
        const cronEndTime = new Date();
        const duration = cronEndTime.getTime() - cronStartTime.getTime();
        logger.info(`Cron job completed successfully in ${duration}ms at ${cronEndTime.toISOString()}`);
      } catch (error: any) {
        logger.error(`Error in cron job at ${new Date().toISOString()}:`, error);
      }
    }, {
      timezone: "Asia/Karachi",
    });

    logger.info("Cron service started - will run daily at 12:00 AM (midnight)");
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      logger.info("Cron service stopped");
    }
  }

  /**
   * Automatically create opening balance from previous day's closing balance
   * This ensures that if system wasn't run for a day, opening balance is still available
   * IMPORTANT: This should NOT create balance transactions - it's just setting the baseline
   */
  async autoCreateOpeningBalanceFromPreviousDay() {
    try {
      // Use Pakistan timezone to get today's date
      const today = getTodayInPakistan();
      const todayStr = formatLocalYMD(today);
      // Parse date string to get components and create at noon (12:00:00)
      const [year, month, day] = todayStr.split("-").map(v => parseInt(v, 10));
      const todayDateObj = new Date(year, month - 1, day, 12, 0, 0, 0);

      // Check if opening balance already exists for today
      const existingOpening = await prisma.dailyOpeningBalance.findUnique({
        where: { date: todayDateObj },
      });
      
      if (existingOpening) {
        logger.info(`Opening balance already exists for ${todayStr}, skipping auto-create`);
        return;
      }

      // Get previous day's closing balance
      // Reuse todayStr, year, month, day from above
      const previousDay = new Date(year, month - 1, day, 12, 0, 0, 0);
      previousDay.setDate(previousDay.getDate() - 1); // Get previous day
      const previousDayStr = formatLocalYMD(previousDay);
      
      // First, ensure previous day's closing balance is calculated
      try {
        await dailyClosingBalanceService.calculateAndStoreClosingBalance(previousDay);
      } catch (error) {
        logger.error(`Error calculating closing balance for ${previousDayStr}:`, error);
      }

      // Get previous day closing balance
      const previousClosing = await dailyClosingBalanceService.getPreviousDayClosingBalance(todayStr);

      if (!previousClosing) {
        logger.warn(`No previous closing balance found for ${previousDayStr}, cannot auto-create opening balance`);
        return;
      }

      // Create opening balance from previous closing balance
      // IMPORTANT: Do NOT create balance transactions here - this is just the baseline
      // Balance transactions will be created when actual transactions happen (sales, purchases, expenses)
      const bankBalancesArray = (previousClosing.bankBalances as Array<{ bankAccountId: string; balance: number }>) || [];
      const cardBalancesArray = (previousClosing.cardBalances as Array<{ cardId: string; balance: number }>) || [];

      // Create opening balance record directly (without creating transactions)
      // Use upsert to prevent duplicate entries if cron runs multiple times
      await prisma.dailyOpeningBalance.upsert({
        where: { date: todayDateObj },
        update: {
          cashBalance: Number(previousClosing.cashBalance) || 0,
          bankBalances: bankBalancesArray as any,
          cardBalances: cardBalancesArray as any,
          notes: "Auto-created from previous day's closing balance (via cron job) - updated",
          userName: "System Auto",
          updatedBy: null,
          updatedByType: "admin",
        },
        create: {
          date: todayDateObj,
          cashBalance: Number(previousClosing.cashBalance) || 0,
          bankBalances: bankBalancesArray as any,
          cardBalances: cardBalancesArray as any,
          notes: `Auto-created from previous day's closing balance (via cron job) at ${new Date().toISOString()}`,
          userName: "System Auto",
          createdBy: null,
          createdByType: "admin",
        },
      });

      logger.info(`Successfully auto-created opening balance for ${todayStr} from previous day's closing balance`);
    } catch (error: any) {
      // If opening balance already exists (race condition), that's okay
      if (error.code === "P2002" || (error.message && error.message.includes("already exists"))) {
        logger.info(`Opening balance already exists for today (created by user or another process)`);
      } else {
        logger.error("Error in auto-create opening balance:", error);
        throw error;
      }
    }
  }

  /**
   * Manually trigger the auto-create opening balance (for testing or manual execution)
   */
  async manualTriggerAutoCreate() {
    logger.info("Manual trigger: Auto-creating opening balance from previous day");
    await this.autoCreateOpeningBalanceFromPreviousDay();
  }
}

export default new CronService();

