import { Router } from "express";
import dashboardController from "../controllers/dashboard.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

// Get dashboard statistics
router.get("/", authenticate, dashboardController.getDashboardStats.bind(dashboardController));

export default router;













