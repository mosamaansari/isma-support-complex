import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Create SuperAdmin
  const superAdminPassword = await bcrypt.hash("superadmin123", 10);
  const superAdmin = await prisma.user.upsert({
    where: { username: "superadmin" },
    update: {},
    create: {
      username: "superadmin",
      password: superAdminPassword,
      role: "superadmin",
      name: "Super Administrator",
      email: "superadmin@ismasports.com",
    },
  });

  // Create Admin
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: adminPassword,
      role: "admin",
      name: "Administrator",
      email: "admin@ismasports.com",
    },
  });

  // Create default categories
  const defaultCategories = [
    { name: "Sports Equipment", description: "Sports and fitness equipment" },
    { name: "Clothing", description: "Sports clothing and apparel" },
    { name: "Footwear", description: "Sports shoes and footwear" },
    { name: "Accessories", description: "Sports accessories" },
    { name: "Nutrition", description: "Sports nutrition and supplements" },
  ];

  for (const cat of defaultCategories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }

  // Create default settings
  const existingSettings = await prisma.shopSettings.findFirst();
  if (!existingSettings) {
    await prisma.shopSettings.create({
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

  console.log("Database seeded successfully!");
  console.log("SuperAdmin:", superAdmin.username);
  console.log("Admin:", admin.username);
  console.log("Default categories created");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

