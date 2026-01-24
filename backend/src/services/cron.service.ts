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
          // Check if closing balance already exists - don't overwrite if it exists
          const [yearPrev, monthPrev, dayPrev] = yesterdayStr.split("-").map(v => parseInt(v, 10));
          const yesterdayDateObj = new Date(yearPrev, monthPrev - 1, dayPrev, 12, 0, 0, 0);
          const existingClosing = await prisma.dailyClosingBalance.findUnique({
            where: { date: yesterdayDateObj },
          });
          
          if (existingClosing) {
            logger.info(`Closing balance already exists for ${yesterdayStr}, skipping calculation to preserve existing data`);
          } else {
            await dailyClosingBalanceService.calculateAndStoreClosingBalance(yesterday);
            logger.info(`Successfully calculated and stored closing balance for ${yesterdayStr} at ${new Date().toISOString()}`);
          }
        } catch (error: any) {
          logger.error(`Error calculating closing balance for ${yesterdayStr}:`, error);
          // Don't throw - continue to opening balance creation
        }
        
        // Step 2: Create today's opening balance from previous day's closing
        logger.info(`Creating opening balance for today: ${todayStr}`);
        try {
          await this.autoCreateOpeningBalanceFromPreviousDay();
          logger.info(`Successfully created opening balance for ${todayStr} at ${new Date().toISOString()}`);
        } catch (error: any) {
          logger.error(`Error creating opening balance for ${todayStr}:`, error);
          // Don't throw - log the error but continue
          // The opening balance might have been created despite the error
        }
        
        const cronEndTime = new Date();
        const duration = cronEndTime.getTime() - cronStartTime.getTime();
        logger.info(`Cron job completed successfully in ${duration}ms at ${cronEndTime.toISOString()}`);
      } catch (error: any) {
        logger.error(`Error in cron job at ${new Date().toISOString()}:`, error);
        // Try to create opening balance even if there was an error in closing balance calculation
        try {
          logger.info(`Attempting to create opening balance despite previous errors`);
          await this.autoCreateOpeningBalanceFromPreviousDay();
        } catch (openingError: any) {
          logger.error(`Failed to create opening balance after error recovery:`, openingError);
        }
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
      
      // First, ensure previous day's closing balance is calculated (only if it doesn't exist)
      try {
        const existingPrevClosing = await prisma.dailyClosingBalance.findUnique({
          where: { date: previousDay },
        });
        if (!existingPrevClosing) {
          logger.info(`No closing balance found for ${previousDayStr}, calculating...`);
          await dailyClosingBalanceService.calculateAndStoreClosingBalance(previousDay);
        } else {
          logger.info(`Closing balance already exists for ${previousDayStr}, skipping calculation to preserve existing data`);
        }
      } catch (error) {
        logger.error(`Error calculating closing balance for ${previousDayStr}:`, error);
      }

      // Get previous day closing balance
      logger.info(`Fetching previous day closing balance for date: ${todayStr} (should get closing balance for ${previousDayStr})`);
      const previousClosing = await dailyClosingBalanceService.getPreviousDayClosingBalance(todayStr);
      
      logger.info(`Previous closing balance result: ${previousClosing ? 'Found' : 'Not Found'}`);
      if (previousClosing) {
        logger.info(`Previous closing balance details: Cash=${previousClosing.cashBalance}, Banks=${JSON.stringify(previousClosing.bankBalances)}, Cards=${JSON.stringify(previousClosing.cardBalances)}`);
      }

      let cashBalance = 0;
      let bankBalancesArray: Array<{ bankAccountId: string; balance: number }> = [];
      let cardBalancesArray: Array<{ cardId: string; balance: number }> = [];
      let notes = "";

      if (!previousClosing) {
        logger.warn(`No previous closing balance found for ${previousDayStr}, creating opening balance with zero values`);
        // Try to directly fetch the closing balance for the previous day
        try {
          const directClosing = await prisma.dailyClosingBalance.findUnique({
            where: { date: previousDay },
          });
          if (directClosing) {
            logger.info(`Found closing balance via direct query for ${previousDayStr}`);
            cashBalance = Number(directClosing.cashBalance) || 0;
            bankBalancesArray = (directClosing.bankBalances as Array<{ bankAccountId: string; balance: number }>) || [];
            cardBalancesArray = (directClosing.cardBalances as Array<{ cardId: string; balance: number }>) || [];
            notes = `Auto-created from previous day (${previousDayStr}) closing balance (via direct query) at ${new Date().toISOString()}`;
          } else {
            notes = `Auto-created with zero balance (no previous closing balance found for ${previousDayStr}) (via cron job) at ${new Date().toISOString()}`;
          }
        } catch (directError) {
          logger.error(`Error fetching closing balance directly for ${previousDayStr}:`, directError);
          notes = `Auto-created with zero balance (no previous closing balance found for ${previousDayStr}) (via cron job) at ${new Date().toISOString()}`;
        }
      } else {
        logger.info(`Found previous day (${previousDayStr}) closing balance: Cash=${previousClosing.cashBalance}, Banks=${(previousClosing.bankBalances || []).length}, Cards=${(previousClosing.cardBalances || []).length}`);
        cashBalance = Number(previousClosing.cashBalance) || 0;
        bankBalancesArray = (previousClosing.bankBalances as Array<{ bankAccountId: string; balance: number }>) || [];
        cardBalancesArray = (previousClosing.cardBalances as Array<{ cardId: string; balance: number }>) || [];
        notes = `Auto-created from previous day (${previousDayStr}) closing balance (via cron job) at ${new Date().toISOString()}`;
      }

      logger.info(`Creating opening balance for today (${todayStr}) from previous day (${previousDayStr}) closing balance`);
      console.log(`Cron Job: Creating opening balance for ${todayStr} from ${previousDayStr} closing balance`);
      console.log(`Previous Closing - Cash: ${cashBalance}, Banks: ${JSON.stringify(bankBalancesArray)}`);

      // Create opening balance record directly (without creating transactions)
      // Use upsert to prevent duplicate entries if cron runs multiple times
      let createdOpening;
      try {
        createdOpening = await prisma.dailyOpeningBalance.upsert({
          where: { date: todayDateObj },
          update: {
            cashBalance: cashBalance,
            bankBalances: bankBalancesArray as any,
            cardBalances: cardBalancesArray as any,
            notes: notes.replace("Auto-created", "Auto-created - updated"),
            userName: "System Auto",
            updatedBy: null,
            updatedByType: "admin",
          },
          create: {
            date: todayDateObj,
            cashBalance: cashBalance,
            bankBalances: bankBalancesArray as any,
            cardBalances: cardBalancesArray as any,
            notes: notes,
            userName: "System Auto",
            createdBy: null,
            createdByType: "admin",
          },
        });

        console.log(`Cron Job: Successfully created/updated opening balance for ${todayStr}`);
        console.log(`Opening Balance - Cash: ${createdOpening.cashBalance}, Banks: ${JSON.stringify(createdOpening.bankBalances)}`);
        logger.info(`Successfully auto-created opening balance for ${todayStr} from previous day (${previousDayStr}) closing balance. Cash: ${createdOpening.cashBalance}, Banks: ${bankBalancesArray.length}, Cards: ${cardBalancesArray.length}`);
      } catch (upsertError: any) {
        // If upsert fails, try to create directly
        logger.warn(`Upsert failed for ${todayStr}, attempting direct create:`, upsertError);
        try {
          createdOpening = await prisma.dailyOpeningBalance.create({
            data: {
              date: todayDateObj,
              cashBalance: cashBalance,
              bankBalances: bankBalancesArray as any,
              cardBalances: cardBalancesArray as any,
              notes: notes,
              userName: "System Auto",
              createdBy: null,
              createdByType: "admin",
            },
          });
          logger.info(`Successfully created opening balance via direct create for ${todayStr}`);
        } catch (createError: any) {
          // If create also fails, it might already exist - verify
          if (createError.code === "P2002") {
            logger.info(`Opening balance already exists for ${todayStr} (unique constraint violation)`);
            // Fetch the existing record
            createdOpening = await prisma.dailyOpeningBalance.findUnique({
              where: { date: todayDateObj },
            });
            if (!createdOpening) {
              throw new Error(`Opening balance should exist for ${todayStr} but could not be retrieved`);
            }
          } else {
            throw createError;
          }
        }
      }

      // Verify the record was created/retrieved
      if (!createdOpening) {
        throw new Error(`Failed to create or retrieve opening balance for ${todayStr}`);
      }

      // Step 3: Create today's closing balance (initially same as opening balance)
      // This ensures we have a closing balance row for today that can be updated as transactions occur
      try {
        const existingTodayClosing = await prisma.dailyClosingBalance.findUnique({
          where: { date: todayDateObj },
        });
        
        if (!existingTodayClosing) {
          logger.info(`Creating initial closing balance for today (${todayStr}) from opening balance`);
          await prisma.dailyClosingBalance.create({
            data: {
              date: todayDateObj,
              cashBalance: cashBalance,
              bankBalances: bankBalancesArray as any,
              cardBalances: cardBalancesArray as any,
            },
          });
          logger.info(`Successfully created initial closing balance for ${todayStr}`);
        } else {
          logger.info(`Closing balance already exists for ${todayStr}, skipping creation`);
        }
      } catch (closingError: any) {
        // If closing balance already exists, that's fine - just log it
        if (closingError.code === "P2002") {
          logger.info(`Closing balance already exists for ${todayStr} (unique constraint)`);
        } else {
          logger.error(`Error creating closing balance for ${todayStr}:`, closingError);
          // Don't throw - opening balance was created successfully
        }
      }

      return createdOpening;
    } catch (error: any) {
      // If opening balance already exists (race condition), try to fetch it
      if (error.code === "P2002" || (error.message && error.message.includes("already exists"))) {
        logger.info(`Opening balance already exists for today (created by user or another process)`);
        // Try to fetch the existing record
        try {
          const today = getTodayInPakistan();
          const todayStr = formatLocalYMD(today);
          const [year, month, day] = todayStr.split("-").map(v => parseInt(v, 10));
          const todayDateObj = new Date(year, month - 1, day, 12, 0, 0, 0);
          const existingOpening = await prisma.dailyOpeningBalance.findUnique({
            where: { date: todayDateObj },
          });
          if (existingOpening) {
            logger.info(`Retrieved existing opening balance for ${todayStr}`);
            return existingOpening;
          }
        } catch (fetchError) {
          logger.error("Error fetching existing opening balance:", fetchError);
        }
      }
      logger.error("Error in auto-create opening balance:", error);
      throw error;
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

