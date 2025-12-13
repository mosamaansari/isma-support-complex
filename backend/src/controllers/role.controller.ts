import { Request, Response } from "express";
import roleService from "../services/role.service";
import logger from "../utils/logger";
import { AuthRequest } from "../middleware/auth";

class RoleController {
  async getRoles(req: AuthRequest, res: Response) {
    try {
      const roles = await roleService.getRoles();
      res.json(roles);
    } catch (error: any) {
      logger.error("Get roles error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}

export default new RoleController();


