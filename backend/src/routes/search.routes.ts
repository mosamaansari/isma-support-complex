import { Router } from "express";
import searchController from "../controllers/search.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

// Global search endpoint
router.get("/", authenticate, searchController.globalSearch.bind(searchController));

export default router;











