import prisma from "../config/database";
import logger from "../utils/logger";
import balanceTransactionService from "./balanceTransaction.service";

interface CardBalance {
  cardId: string;
  balance: number;
}

interface BankBalance {
  bankAccountId: string;
  balance: number;
}

class OpeningBalanceService {
  async getOpeningBalance(date: string) {
    // Parse date string (YYYY-MM-DD) and create date object for comparison
    const dateParts = date.split("-");
    const targetDate = new Date(
      parseInt(dateParts[0]),
      parseInt(dateParts[1]) - 1,
      parseInt(dateParts[2])
    );

    // Get opening balance for the date (compare only date part, ignore time)
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    let openingBalance = await prisma.dailyOpeningBalance.findFirst({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // If no opening balance exists, automatically get previous day's closing balance
    if (!openingBalance) {
      const dailyClosingBalanceService = (await import("./dailyClosingBalance.service")).default;
      try {
        const previousClosing = await dailyClosingBalanceService.getPreviousDayClosingBalance(date);
        if (previousClosing) {
          // Create a virtual opening balance from previous closing balance
          const bankBalancesArray = (previousClosing.bankBalances as Array<{ bankAccountId: string; balance: number }>) || [];
          const cardBalancesArray = (previousClosing.cardBalances as Array<{ cardId: string; balance: number }>) || [];
          
          // Return previous closing balance as opening balance (without creating a record)
          return {
            id: `auto-${date}`,
            date: targetDate,
            cashBalance: Number(previousClosing.cashBalance) || 0,
            bankBalances: bankBalancesArray,
            cardBalances: cardBalancesArray,
            notes: "Auto-loaded from previous day's closing balance",
            userId: null as string | null,
            userName: "System",
            createdAt: targetDate,
            updatedAt: targetDate,
          };
        }
      } catch (error) {
        logger.error("Error getting previous day closing balance:", error);
      }
      
      // If no previous closing balance found either, return null
      return null;
    }

    // Now calculate the running balance by adding transactions to this baseline
    const balanceManagementService = (await import("./balanceManagement.service")).default;

    const currentCash = await balanceManagementService.getCurrentCashBalance(targetDate);

    // Get all active bank accounts to ensure we show all banks
    const allBanks = await prisma.bankAccount.findMany({
      where: { isActive: true },
      select: { id: true },
    });

    // Calculate bank balances for each stored bank account in opening balance
    const bankBalancesMap = new Map<string, number>();
    const bankBalances = (openingBalance.bankBalances as Array<{ bankAccountId: string; balance: number }>) || [];
    
    // First, get balances from opening balance record
    for (const b of bankBalances) {
      bankBalancesMap.set(b.bankAccountId, await balanceManagementService.getCurrentBankBalance(b.bankAccountId, targetDate));
    }

    // Also check all active banks - if they have transactions, include them even if not in opening balance
    for (const bank of allBanks) {
      if (!bankBalancesMap.has(bank.id)) {
        const balance = await balanceManagementService.getCurrentBankBalance(bank.id, targetDate);
        if (balance > 0) {
          bankBalancesMap.set(bank.id, balance);
        }
      }
    }

    const runningBankBalances = Array.from(bankBalancesMap.entries()).map(([bankAccountId, balance]) => ({
      bankAccountId,
      balance,
    }));

    return {
      ...openingBalance,
      cashBalance: currentCash,
      bankBalances: runningBankBalances,
    };
  }

  async getOpeningBalances(startDate?: string, endDate?: string) {
    const where: any = {};

    if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const openingBalances = await prisma.dailyOpeningBalance.findMany({
      where,
      orderBy: { date: "desc" },
    });

    return openingBalances;
  }

  async createOpeningBalance(
    data: {
      date: string;
      cashBalance: number;
      bankBalances?: BankBalance[];
      cardBalances?: CardBalance[]; // Deprecated, kept for backward compatibility
      notes?: string;
    },
    userInfo: {
      id: string;
      username: string;
      name?: string;
      userType?: "user" | "admin";
    }
  ) {
    // Validate cash balance
    if (data.cashBalance < 0) {
      throw new Error("Cash balance cannot be negative");
    }

    const userId = userInfo.id;
    const userName = userInfo.name || userInfo.username;
    const userType = userInfo.userType || "user";
    let actualUserId: string | null = null;

    // Verify user exists in the correct table based on userType
    if (userType === "admin") {
      // Verify admin user exists in admin_users table
      const adminUser = await prisma.adminUser.findUnique({
        where: { id: userId },
        select: { id: true, name: true }
      });
      if (!adminUser) {
        throw new Error("Admin user not found");
      }
      // For admin users, set userId to null because foreign key constraint
      // only allows values from users table, not admin_users table
      actualUserId = null;
    } else {
      // Verify regular user exists in users table
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true }
      });
      if (!user) {
        throw new Error("User not found");
      }
      // For regular users, we can use userId directly
      actualUserId = userId;
    }

    // Check if opening balance already exists for this date
    const dateObj = new Date(data.date);
    dateObj.setHours(0, 0, 0, 0);
    const existing = await prisma.dailyOpeningBalance.findUnique({
      where: { date: dateObj },
    });

    if (existing) {
      throw new Error("Opening balance already exists for this date");
    }

    // Build the data object for creating opening balance
    const createData: any = {
      date: dateObj,
      cashBalance: data.cashBalance,
      bankBalances: (data.bankBalances || []) as any,
      cardBalances: (data.cardBalances || []) as any, // Keep for backward compatibility
      notes: data.notes || null,
      userName: userName,
      createdBy: userId,
      createdByType: userType,
    };

    // Only connect user relation if userId is not null (i.e., for regular users)
    // For admin users, userId remains null and no user relation is connected
    if (actualUserId !== null) {
      createData.user = {
        connect: { id: actualUserId }
      };
    }

    const openingBalance = await prisma.dailyOpeningBalance.create({
      data: createData,
    });

    // IMPORTANT: Do NOT create balance transactions when creating opening balance
    // Opening balance is just the baseline. Transactions will be created only when:
    // 1. Users manually add to opening balance (via addToOpeningBalance)
    // 2. Sales, purchases, expenses occur (handled by their respective services)
    // 
    // This prevents double-counting and ensures accurate balance calculations.
    // The opening balance record itself represents the starting point for the day.

    logger.info(`Opening balance created for ${data.date}: Cash=${data.cashBalance}, Banks=${data.bankBalances?.length || 0}`);

    return openingBalance;
  }

  async updateOpeningBalance(
    id: string,
    data: {
      cashBalance?: number;
      bankBalances?: BankBalance[];
      cardBalances?: CardBalance[]; // Deprecated, kept for backward compatibility
      notes?: string;
    },
    userInfo?: {
      id: string;
      userType?: "user" | "admin";
    }
  ) {
    const openingBalance = await prisma.dailyOpeningBalance.findUnique({
      where: { id },
    });

    if (!openingBalance) {
      throw new Error("Opening balance not found");
    }

    const updateData: any = {};
    let cashDifference = 0;
    const bankDifferences: Array<{ bankAccountId: string; difference: number }> = [];

    if (data.cashBalance !== undefined) {
      // Validate cash balance
      if (data.cashBalance < 0) {
        throw new Error("Cash balance cannot be negative");
      }
      const oldCash = Number(openingBalance.cashBalance) || 0;
      cashDifference = data.cashBalance - oldCash;
      // We no longer update baseline updateData.cashBalance = data.cashBalance;
    }
    if (data.bankBalances !== undefined) {
      const oldBankBalances = (openingBalance.bankBalances as any[]) || [];
      const oldBankMap = new Map(
        oldBankBalances.map((b: any) => [b.bankAccountId, Number(b.balance) || 0])
      );

      for (const newBankBalance of data.bankBalances) {
        const oldBalance = oldBankMap.get(newBankBalance.bankAccountId) || 0;
        const difference = newBankBalance.balance - oldBalance;
        if (difference !== 0) {
          bankDifferences.push({
            bankAccountId: newBankBalance.bankAccountId,
            difference,
          });
        }
      }
      // We no longer update baseline updateData.bankBalances = data.bankBalances as any;
    }
    if (data.cardBalances !== undefined) updateData.cardBalances = data.cardBalances as any;
    if (data.notes !== undefined) updateData.notes = data.notes;

    // Update updatedBy and updatedByType if userInfo is provided
    if (userInfo) {
      updateData.updatedBy = userInfo.id;
      updateData.updatedByType = userInfo.userType || "user";
    }

    // Use balance management service for atomic updates when adding/deducting amounts
    // This will update the balance in the database AND create transaction records
    if (userInfo && (cashDifference !== 0 || bankDifferences.length > 0)) {
      try {
        // Get user name
        let userName = "";
        if (userInfo.userType === "admin") {
          const adminUser = await prisma.adminUser.findUnique({
            where: { id: userInfo.id },
            select: { name: true, username: true },
          });
          userName = adminUser?.name || adminUser?.username || "";
        } else {
          const user = await prisma.user.findUnique({
            where: { id: userInfo.id },
            select: { name: true, username: true },
          });
          userName = user?.name || user?.username || "";
        }

        // Get the opening balance date
        const openingBalance = await prisma.dailyOpeningBalance.findUnique({
          where: { id },
        });
        if (!openingBalance) {
          throw new Error("Opening balance not found");
        }
        const dateObj = openingBalance.date;

        // Use current date and time for transactions
        const transactionDate = new Date(); // Always use current date and time
        const balanceManagementService = (await import("./balanceManagement.service")).default;

        // Use balance management service for cash difference (atomic update with locking)
        // This will update the balance in dailyOpeningBalance table
        if (cashDifference !== 0) {
          if (cashDifference > 0) {
            // Adding cash
            await balanceManagementService.addToOpeningBalance(
              dateObj,
              cashDifference,
              "cash",
              {
                description: data.notes || "Added to opening balance - Cash",
                userId: userInfo.id,
                userName: userName,
              }
            );
          } else {
            // Deducting cash - use updateCashBalance with expense type
            await balanceManagementService.updateCashBalance(
              dateObj,
              Math.abs(cashDifference),
              "expense",
              {
                description: data.notes || "Deducted from opening balance - Cash",
                source: "opening_balance_deduction",
                sourceId: openingBalance.id,
                userId: userInfo.id,
                userName: userName,
              }
            );
          }
        }

        // Use balance management service for bank differences (atomic update with locking)
        // This will update the balance in dailyOpeningBalance table
        for (const bankDiff of bankDifferences) {
          if (bankDiff.difference !== 0) {
            if (bankDiff.difference > 0) {
              // Adding to bank
              await balanceManagementService.addToOpeningBalance(
                dateObj,
                bankDiff.difference,
                "bank",
                {
                  description: data.notes || "Added to opening balance - Bank",
                  userId: userInfo.id,
                  userName: userName,
                  bankAccountId: bankDiff.bankAccountId,
                }
              );
            } else {
              // Deducting from bank - use updateBankBalance with expense type
              await balanceManagementService.updateBankBalance(
                bankDiff.bankAccountId,
                dateObj,
                Math.abs(bankDiff.difference),
                "expense",
                {
                  description: data.notes || "Deducted from opening balance - Bank",
                  source: "opening_balance_deduction",
                  sourceId: openingBalance.id,
                  userId: userInfo.id,
                  userName: userName,
                }
              );
            }
          }
        }
      } catch (error) {
        logger.error("Error updating balance through balance management service:", error);
        // Re-throw to prevent inconsistent state
        throw error;
      }
    } else {
      // If no balance changes or no userInfo, just update notes and other fields
      // Don't update balance fields if they're not changing
      const finalUpdateData: any = {};
      if (data.notes !== undefined) finalUpdateData.notes = data.notes;
      if (userInfo) {
        finalUpdateData.updatedBy = userInfo.id;
        finalUpdateData.updatedByType = userInfo.userType || "user";
      }

      if (Object.keys(finalUpdateData).length > 0) {
        await prisma.dailyOpeningBalance.update({
          where: { id },
          data: finalUpdateData,
        });
      }
    }

    // Return the updated opening balance
    const updated = await prisma.dailyOpeningBalance.findUnique({
      where: { id },
    });

    if (!updated) {
      throw new Error("Failed to retrieve updated opening balance");
    }

    return updated;
  }

  async deleteOpeningBalance(id: string) {
    const openingBalance = await prisma.dailyOpeningBalance.findUnique({
      where: { id },
    });

    if (!openingBalance) {
      throw new Error("Opening balance not found");
    }

    await prisma.dailyOpeningBalance.delete({
      where: { id },
    });

    return { message: "Opening balance deleted successfully" };
  }
}

export default new OpeningBalanceService();

