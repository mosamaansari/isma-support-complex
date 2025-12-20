import { Router } from "express";
import dailyClosingBalanceController from "../controllers/dailyClosingBalance.controller";
import { authenticate } from "../middleware/auth";
import { requirePermission } from "../middleware/permissions";
import { PERMISSIONS } from "../utils/permissions";

const router = Router();

router.get(
  "/",
  authenticate,
  requirePermission(PERMISSIONS.CLOSING_BALANCE_VIEW),
  dailyClosingBalanceController.getClosingBalance.bind(dailyClosingBalanceController)
);
router.get(
  "/previous",
  authenticate,
  requirePermission(PERMISSIONS.CLOSING_BALANCE_VIEW),
  dailyClosingBalanceController.getPreviousDayClosingBalance.bind(dailyClosingBalanceController)
);
router.get(
  "/range",
  authenticate,
  requirePermission(PERMISSIONS.CLOSING_BALANCE_VIEW),
  dailyClosingBalanceController.getClosingBalances.bind(dailyClosingBalanceController)
);
router.post(
  "/calculate",
  authenticate,
  requirePermission(PERMISSIONS.CLOSING_BALANCE_CALCULATE),
  dailyClosingBalanceController.calculateClosingBalance.bind(dailyClosingBalanceController)
);

export default router;

