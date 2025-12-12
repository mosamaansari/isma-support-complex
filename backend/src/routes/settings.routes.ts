import express, { Router } from "express";
import { body, validationResult } from "express-validator";
import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger";
import { authenticate, authorize, AuthRequest } from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

// Get settings
router.get("/", authenticate, async (req: AuthRequest, res) => {
  try {
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

    res.json(settings);
  } catch (error) {
    logger.error("Get settings error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update settings
router.put(
  "/",
  authenticate,
  authorize("superadmin", "admin"),
  [
    body("shopName").notEmpty().withMessage("Shop name is required"),
    body("contactNumber").notEmpty().withMessage("Contact number is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("address").notEmpty().withMessage("Address is required"),
    body("bankName").notEmpty().withMessage("Bank name is required"),
    body("bankAccountNumber").notEmpty().withMessage("Bank account number is required"),
    body("ifscCode").notEmpty().withMessage("IFSC code is required"),
  ],
  async (req: AuthRequest, res: express.Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      let settings = await prisma.shopSettings.findFirst();

      if (settings) {
        settings = await prisma.shopSettings.update({
          where: { id: settings.id },
          data: {
            shopName: req.body.shopName,
            logo: req.body.logo,
            contactNumber: req.body.contactNumber,
            email: req.body.email,
            address: req.body.address,
            bankAccountNumber: req.body.bankAccountNumber,
            bankName: req.body.bankName,
            ifscCode: req.body.ifscCode,
            gstNumber: req.body.gstNumber,
          },
        });
      } else {
        settings = await prisma.shopSettings.create({
          data: {
            shopName: req.body.shopName,
            logo: req.body.logo,
            contactNumber: req.body.contactNumber,
            email: req.body.email,
            address: req.body.address,
            bankAccountNumber: req.body.bankAccountNumber,
            bankName: req.body.bankName,
            ifscCode: req.body.ifscCode,
            gstNumber: req.body.gstNumber,
          },
        });
      }

      logger.info(`Settings updated by ${req.user?.username}`);
      res.json(settings);
    } catch (error) {
      logger.error("Update settings error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;

