import prisma from "../config/database";
import logger from "../utils/logger";

class SettingsService {
  async getSettings() {
    let settings = await prisma.shopSettings.findFirst();

    if (!settings) {
      // Create default settings
      settings = await prisma.shopSettings.create({
        data: {
          shopName: "Isma Sports Complex",
          logo: "/images/logo/logo.png",
          contactNumber: "+92 300 1234567",
          email: "info@ismasports.com",
          address: "Karachi, Pakistan",
          bankAccountNumber: "1234567890123456",
          bankName: "Bank Name",
          ifscCode: "IFSC123456",
        },
      });
    }

    return settings;
  }

  async updateSettings(data: {
    shopName: string;
    logo?: string;
    contactNumber: string;
    email: string;
    address: string;
    bankAccountNumber: string;
    bankName: string;
    ifscCode: string;
    gstNumber?: string;
  }) {
    let settings = await prisma.shopSettings.findFirst();

    if (settings) {
      settings = await prisma.shopSettings.update({
        where: { id: settings.id },
        data: {
          shopName: data.shopName,
          logo: data.logo || null,
          contactNumber: data.contactNumber,
          email: data.email,
          address: data.address,
          bankAccountNumber: data.bankAccountNumber,
          bankName: data.bankName,
          ifscCode: data.ifscCode,
          gstNumber: data.gstNumber || null,
        },
      });
    } else {
      settings = await prisma.shopSettings.create({
        data: {
          shopName: data.shopName,
          logo: data.logo || null,
          contactNumber: data.contactNumber,
          email: data.email,
          address: data.address,
          bankAccountNumber: data.bankAccountNumber,
          bankName: data.bankName,
          ifscCode: data.ifscCode,
          gstNumber: data.gstNumber || null,
        },
      });
    }

    return settings;
  }
}

export default new SettingsService();


