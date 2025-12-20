import prisma from "../config/database";
import logger from "../utils/logger";

interface CardBalance {
  cardId: string;
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
      cardBalances?: CardBalance[];
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
    if (data.cashBalance < 1) {
      throw new Error("Cash balance must be at least 1");
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

    // Build the data object for creating opening balance
    const createData: any = {
      date: new Date(data.date),
      cashBalance: data.cashBalance,
      cardBalances: (data.cardBalances || []) as any,
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

    return openingBalance;
  }

  async updateOpeningBalance(
    id: string,
    data: {
      cashBalance?: number;
      cardBalances?: CardBalance[];
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
    if (data.cashBalance !== undefined) {
      // Validate cash balance
      if (data.cashBalance < 1) {
        throw new Error("Cash balance must be at least 1");
      }
      updateData.cashBalance = data.cashBalance;
    }
    if (data.cardBalances !== undefined) updateData.cardBalances = data.cardBalances as any;
    if (data.notes !== undefined) updateData.notes = data.notes;

    // Update updatedBy and updatedByType if userInfo is provided
    if (userInfo) {
      updateData.updatedBy = userInfo.id;
      updateData.updatedByType = userInfo.userType || "user";
    }

    const updated = await prisma.dailyOpeningBalance.update({
      where: { id },
      data: updateData,
    });

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

