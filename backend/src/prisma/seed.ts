import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

// Type assertion needed due to Prisma 7 type definitions
const prisma = new PrismaClient({
  adapter,
} as any);

async function main() {
  console.log("Seeding database...");

  // Create SuperAdmin in AdminUser table
  const superAdminPassword = await bcrypt.hash("superadmin123", 10);
  const superAdmin = await prisma.adminUser.upsert({
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

  // Create Admin in AdminUser table
  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.adminUser.upsert({
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

