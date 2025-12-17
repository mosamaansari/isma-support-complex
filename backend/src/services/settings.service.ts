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
          bankAccountNumber: "",
          bankName: "",
          ifscCode: "",
        },
      });
    }

    return settings;
  }

  async updateSettings(data: {
    shopName: string;
    logo?: string;
    contactNumber: string;
    email?: string;
    address?: string;
    gstNumber?: string;
  }) {
    let settings = await prisma.shopSettings.findFirst();

    if (settings) {
      settings = await prisma.shopSettings.update({
        where: { id: settings.id },
        data: {
          shopName: data.shopName,
          logo: data.logo || settings.logo || null,
          contactNumber: data.contactNumber,
          email: data.email || settings.email || "",
          address: data.address || settings.address || "",
          bankAccountNumber: "",
          bankName: "",
          ifscCode: "",
          gstNumber: data.gstNumber || settings.gstNumber || null,
        },
      });
    } else {
      settings = await prisma.shopSettings.create({
        data: {
          shopName: data.shopName,
          logo: data.logo || "/images/logo/logo.png",
          contactNumber: data.contactNumber,
          email: data.email || "",
          address: data.address || "",
          bankAccountNumber: "",
          bankName: "",
          ifscCode: "",
          gstNumber: data.gstNumber || null,
        },
      });
    }

    return settings;
  }
}

export default new SettingsService();


