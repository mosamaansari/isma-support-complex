import prisma from "../config/database";
import logger from "../utils/logger";

class BankAccountService {
  async getBankAccounts() {
    const accounts = await prisma.bankAccount.findMany({
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
    });

    return accounts;
  }

  async getBankAccount(id: string) {
    const account = await prisma.bankAccount.findUnique({
      where: { id },
    });

    if (!account) {
      throw new Error("Bank account not found");
    }

    return account;
  }

  async getDefaultBankAccount() {
    const account = await prisma.bankAccount.findFirst({
      where: {
        isDefault: true,
        isActive: true,
      },
    });

    return account;
  }

  async createBankAccount(data: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    ifscCode: string;
    accountHolder?: string;
    branchName?: string;
    isDefault?: boolean;
    isActive?: boolean;
  }) {
    // If setting as default, unset other default accounts
    if (data.isDefault) {
      await prisma.bankAccount.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const account = await prisma.bankAccount.create({
      data: {
        accountName: data.accountName,
        accountNumber: data.accountNumber,
        bankName: data.bankName,
        ifscCode: data.ifscCode,
        accountHolder: data.accountHolder || null,
        branchName: data.branchName || null,
        isDefault: data.isDefault || false,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });

    return account;
  }

  async updateBankAccount(
    id: string,
    data: {
      accountName?: string;
      accountNumber?: string;
      bankName?: string;
      ifscCode?: string;
      accountHolder?: string;
      branchName?: string;
      isDefault?: boolean;
      isActive?: boolean;
    }
  ) {
    const account = await prisma.bankAccount.findUnique({
      where: { id },
    });

    if (!account) {
      throw new Error("Bank account not found");
    }

    // If setting as default, unset other default accounts
    if (data.isDefault === true) {
      await prisma.bankAccount.updateMany({
        where: {
          isDefault: true,
          id: { not: id },
        },
        data: { isDefault: false },
      });
    }

    const updateData: any = {};
    if (data.accountName !== undefined) updateData.accountName = data.accountName;
    if (data.accountNumber !== undefined) updateData.accountNumber = data.accountNumber;
    if (data.bankName !== undefined) updateData.bankName = data.bankName;
    if (data.ifscCode !== undefined) updateData.ifscCode = data.ifscCode;
    if (data.accountHolder !== undefined) updateData.accountHolder = data.accountHolder || null;
    if (data.branchName !== undefined) updateData.branchName = data.branchName || null;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const updatedAccount = await prisma.bankAccount.update({
      where: { id },
      data: updateData,
    });

    return updatedAccount;
  }

  async deleteBankAccount(id: string) {
    const account = await prisma.bankAccount.findUnique({
      where: { id },
    });

    if (!account) {
      throw new Error("Bank account not found");
    }

    await prisma.bankAccount.delete({
      where: { id },
    });
  }
}

export default new BankAccountService();


