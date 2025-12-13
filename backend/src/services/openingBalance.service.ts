import prisma from "../config/database";
import logger from "../utils/logger";

interface CardBalance {
  cardId: string;
  balance: number;
}

class OpeningBalanceService {
  async getOpeningBalance(date: string) {
    const openingBalance = await prisma.dailyOpeningBalance.findUnique({
      where: { date: new Date(date) },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
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
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
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
    userId: string
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");

    // Check if opening balance already exists for this date
    const existing = await prisma.dailyOpeningBalance.findUnique({
      where: { date: new Date(data.date) },
    });

    if (existing) {
      throw new Error("Opening balance already exists for this date");
    }

    const openingBalance = await prisma.dailyOpeningBalance.create({
      data: {
        date: new Date(data.date),
        cashBalance: data.cashBalance,
        cardBalances: (data.cardBalances || []) as any,
        notes: data.notes || null,
        userId: user.id,
        userName: user.name,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
    });

    return openingBalance;
  }

  async updateOpeningBalance(
    id: string,
    data: {
      cashBalance?: number;
      cardBalances?: CardBalance[];
      notes?: string;
    }
  ) {
    const openingBalance = await prisma.dailyOpeningBalance.findUnique({
      where: { id },
    });

    if (!openingBalance) {
      throw new Error("Opening balance not found");
    }

    const updateData: any = {};
    if (data.cashBalance !== undefined) updateData.cashBalance = data.cashBalance;
    if (data.cardBalances !== undefined) updateData.cardBalances = data.cardBalances as any;
    if (data.notes !== undefined) updateData.notes = data.notes;

    const updated = await prisma.dailyOpeningBalance.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            username: true,
          },
        },
      },
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

