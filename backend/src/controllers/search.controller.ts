import { Response } from "express";
import searchService from "../services/search.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class SearchController {
  async globalSearch(req: AuthRequest, res: Response) {
    try {
      const { q } = req.query;

      if (!q || typeof q !== "string") {
        return res.status(400).json({ error: "Search query is required" });
      }

      const userPermissions = req.user?.permissions || [];
      const userRole = req.user?.role || "";

      const results = await searchService.globalSearch(q, userPermissions, userRole);

      res.json({ results });
    } catch (error: any) {
      logger.error("Global search error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

export default new SearchController();








