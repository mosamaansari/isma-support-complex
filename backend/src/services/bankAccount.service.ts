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
    accountHolder?: string;
    branchName?: string;
    isDefault?: boolean;
    isActive?: boolean;
  }) {
    // Check if account number + bank name combination already exists
    const existingAccount = await prisma.bankAccount.findFirst({
      where: {
        accountNumber: data.accountNumber,
        bankName: data.bankName,
      },
    });

    if (existingAccount) {
      throw new Error("An account with this account number and bank name already exists");
    }

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
        ifscCode: "", // Set empty string for IFSC code
        accountHolder: data.accountHolder || data.accountName || null, // Use accountName if accountHolder not provided
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

    // Check if account number + bank name combination already exists (excluding current account)
    const accountNumber = data.accountNumber !== undefined ? data.accountNumber : account.accountNumber;
    const bankName = data.bankName !== undefined ? data.bankName : account.bankName;

    // Only check if accountNumber or bankName is being changed
    if (data.accountNumber !== undefined || data.bankName !== undefined) {
      const existingAccount = await prisma.bankAccount.findFirst({
        where: {
          accountNumber: accountNumber,
          bankName: bankName,
          id: { not: id }, // Exclude current account
        },
      });

      if (existingAccount) {
        throw new Error("An account with this account number and bank name already exists");
      }
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
    if (data.accountName !== undefined) {
      updateData.accountName = data.accountName;
      // Auto-update accountHolder if not provided separately
      if (data.accountHolder === undefined) {
        updateData.accountHolder = data.accountName;
      }
    }
    if (data.accountNumber !== undefined) updateData.accountNumber = data.accountNumber;
    if (data.bankName !== undefined) updateData.bankName = data.bankName;
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


