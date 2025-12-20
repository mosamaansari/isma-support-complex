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
    // Set time to noon to avoid timezone issues
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

    const openingBalance = await prisma.dailyOpeningBalance.findFirst({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return openingBalance;
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

    // Create transaction record for opening balance
    // Use current date and time for transactions
    try {
      const transactionDate = new Date(); // Always use current date and time
      
      if (data.cashBalance > 0) {
        await balanceTransactionService.createTransaction({
          date: transactionDate,
          type: "income",
          amount: data.cashBalance,
          paymentType: "cash",
          description: data.notes || "Opening balance - Cash",
          source: "opening_balance",
          sourceId: openingBalance.id,
          userId: userId,
          userName: userName,
        });
      }

      // Create transaction records for bank balances
      if (data.bankBalances && data.bankBalances.length > 0) {
        for (const bankBalance of data.bankBalances) {
          if (bankBalance.balance > 0) {
            await balanceTransactionService.createTransaction({
              date: transactionDate,
              type: "income",
              amount: bankBalance.balance,
              paymentType: "bank_transfer",
              bankAccountId: bankBalance.bankAccountId,
              description: data.notes || "Opening balance - Bank",
              source: "opening_balance",
              sourceId: openingBalance.id,
              userId: userId,
              userName: userName,
            });
          }
        }
      }
    } catch (error) {
      logger.error("Error creating transaction records:", error);
      // Don't fail the opening balance creation if transaction record fails
    }

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
      updateData.cashBalance = data.cashBalance;
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
      updateData.bankBalances = data.bankBalances as any;
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

