import prisma from "../config/database";
import logger from "../utils/logger";

class RoleService {
  async getRoles() {
    // Return default roles from enum
    // In future, can extend to use Role model if custom roles are needed
    const defaultRoles = [
      { name: "superadmin", label: "Super Admin", description: "Full system access" },
      { name: "admin", label: "Admin", description: "Administrative access" },
      { name: "cashier", label: "Cashier", description: "Sales and billing access" },
      {
        name: "warehouse_manager",
        label: "Warehouse Manager",
        description: "Inventory management access",
      },
    ];

    return defaultRoles;
  }
}

export default new RoleService();


