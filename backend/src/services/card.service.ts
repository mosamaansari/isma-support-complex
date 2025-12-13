import prisma from "../config/database";
import logger from "../utils/logger";

class CardService {
  async getCards() {
    const cards = await prisma.card.findMany({
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
    });

    return cards;
  }

  async getCard(id: string) {
    const card = await prisma.card.findUnique({
      where: { id },
    });

    if (!card) {
      throw new Error("Card not found");
    }

    return card;
  }

  async getDefaultCard() {
    const card = await prisma.card.findFirst({
      where: {
        isDefault: true,
        isActive: true,
      },
    });

    return card;
  }

  async createCard(data: {
    name: string;
    cardNumber?: string;
    bankName?: string;
    accountHolder?: string;
    isDefault?: boolean;
    isActive?: boolean;
  }) {
    // If setting as default, unset other default cards
    if (data.isDefault) {
      await prisma.card.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const card = await prisma.card.create({
      data: {
        name: data.name,
        cardNumber: data.cardNumber || null,
        bankName: data.bankName || null,
        accountHolder: data.accountHolder || null,
        isDefault: data.isDefault || false,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });

    return card;
  }

  async updateCard(
    id: string,
    data: {
      name?: string;
      cardNumber?: string;
      bankName?: string;
      accountHolder?: string;
      isDefault?: boolean;
      isActive?: boolean;
    }
  ) {
    const card = await prisma.card.findUnique({
      where: { id },
    });

    if (!card) {
      throw new Error("Card not found");
    }

    // If setting as default, unset other default cards
    if (data.isDefault === true) {
      await prisma.card.updateMany({
        where: {
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.cardNumber !== undefined) updateData.cardNumber = data.cardNumber || null;
    if (data.bankName !== undefined) updateData.bankName = data.bankName || null;
    if (data.accountHolder !== undefined) updateData.accountHolder = data.accountHolder || null;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const updatedCard = await prisma.card.update({
      where: { id },
      data: updateData,
    });

    return updatedCard;
  }

  async deleteCard(id: string) {
    const card = await prisma.card.findUnique({
      where: { id },
    });

    if (!card) {
      throw new Error("Card not found");
    }

    await prisma.card.delete({
      where: { id },
    });
  }
}

export default new CardService();


