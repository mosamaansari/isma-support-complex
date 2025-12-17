import prisma from "../config/database";
import logger from "../utils/logger";

class RoleService {
  async getRoles() {
    // Get default/predefined roles
    const defaultRoles = [
      { name: "superadmin", label: "Super Admin", description: "Full system access", isCustom: false },
      { name: "admin", label: "Admin", description: "Administrative access", isCustom: false },
      { name: "cashier", label: "Cashier", description: "Sales and billing access", isCustom: false },
      {
        name: "warehouse_manager",
        label: "Warehouse Manager",
        description: "Inventory management access",
        isCustom: false,
      },
    ];

    // Get custom roles from database
    try {
      const customRoles = await prisma.role.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "desc" },
      });

      const customRolesFormatted = customRoles.map((role) => ({
        name: role.name,
        label: role.label,
        description: role.description || undefined,
        isCustom: true,
      }));

      return [...defaultRoles, ...customRolesFormatted];
    } catch (error) {
      logger.error("Error fetching custom roles:", error);
      // Return only default roles if database query fails
      return defaultRoles;
    }
  }

  async createRole(data: { name: string; label: string; description?: string }) {
    // Validate role name format
    const roleNameRegex = /^[a-z][a-z0-9_]*$/;
    if (!roleNameRegex.test(data.name.trim())) {
      throw new Error("Role name must be lowercase, start with a letter, and can contain underscores");
    }

    // Check if role name already exists (in default roles or database)
    const defaultRoleNames = ["superadmin", "admin", "cashier", "warehouse_manager"];
    if (defaultRoleNames.includes(data.name.trim().toLowerCase())) {
      throw new Error("This role name is reserved and cannot be used");
    }

    // Check if role already exists in database
    const existingRole = await prisma.role.findUnique({
      where: { name: data.name.trim().toLowerCase() },
    });

    if (existingRole) {
      throw new Error("Role with this name already exists");
    }

    // Create new role
    const role = await prisma.role.create({
      data: {
        name: data.name.trim().toLowerCase(),
        label: data.label.trim(),
        description: data.description?.trim() || null,
        isActive: true,
      },
    });

    return {
      name: role.name,
      label: role.label,
      description: role.description || undefined,
      isCustom: true,
    };
  }

  async updateRole(id: string, data: { label?: string; description?: string; isActive?: boolean }) {
    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new Error("Role not found");
    }

    const updateData: any = {};
    if (data.label !== undefined) updateData.label = data.label.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const updatedRole = await prisma.role.update({
      where: { id },
      data: updateData,
    });

    return {
      name: updatedRole.name,
      label: updatedRole.label,
      description: updatedRole.description || undefined,
      isCustom: true,
    };
  }

  async deleteRole(id: string) {
    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new Error("Role not found");
    }

    await prisma.role.delete({
      where: { id },
    });
  }
}

export default new RoleService();


