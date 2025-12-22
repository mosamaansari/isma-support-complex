import bcrypt from "bcryptjs";
import prisma from "../config/database";
import logger from "../utils/logger";
import emailService from "./email.service";

class UserService {
  async getUsers(filters?: { page?: number; pageSize?: number }) {
    const page = filters?.page || 1;
    const pageSize = filters?.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          role: true,
          profilePicture: true,
          permissions: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.user.count(),
    ]);

    return {
      data: users,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getUser(id: string) {
    let user: any = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        profilePicture: true,
        createdAt: true,
      },
    });

    if (!user) {
      // Check admin users table
      const adminUser = await prisma.adminUser.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          role: true,
          profilePicture: true,
          createdAt: true,
        },
      });

      if (adminUser) {
        // Admin users have full access, so we can return empty permissions or specific admin permissions if needed
        // For consistency, we'll just add an empty permissions array as admins typically bypass permission checks or have their own logic
        user = { ...adminUser, permissions: [] };
      }
    }

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  }

  async createUser(data: {
    username: string;
    password: string;
    name: string;
    email?: string;
    role: string;
    permissions?: string[];
    profilePicture?: string;
  }) {
    // Validate role exists (either default enum role or custom role in database)
    const defaultRoles = ["superadmin", "admin", "cashier", "warehouse_manager"];
    if (!defaultRoles.includes(data.role)) {
      // Check if it's a custom role in database
      const customRole = await prisma.role.findUnique({
        where: { name: data.role, isActive: true },
      });
      if (!customRole) {
        throw new Error(`Invalid role: ${data.role}. Role does not exist.`);
      }
    }

    // Check if username exists in regular users
    const existingUser = await prisma.user.findUnique({
      where: { username: data.username },
    });

    if (existingUser) {
      throw new Error("Username already exists");
    }

    // Check if username exists in admin users
    const existingAdminUser = await prisma.adminUser.findUnique({
      where: { username: data.username },
    });

    if (existingAdminUser) {
      throw new Error("Username already exists");
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
      data: {
        username: data.username,
        password: hashedPassword,
        name: data.name,
        email: data.email || null,
        role: data.role,
        permissions: data.permissions || [],
        profilePicture: data.profilePicture || null,
      },
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        profilePicture: true,
        createdAt: true,
      },
    });

    // Send account creation email if email exists
    if (user.email) {
      emailService.sendAccountCreatedEmail(user.email, user.name, user.username).catch((err) => {
        logger.error("Failed to send account creation email:", err);
      });
    }

    return user;
  }

  async updateUser(
    id: string,
    data: {
      name?: string;
      email?: string;
      role?: string;
      permissions?: string[];
      password?: string;
      profilePicture?: string;
    }
  ) {
    // Validate role if provided
    if (data.role !== undefined) {
      const defaultRoles = ["superadmin", "admin", "cashier", "warehouse_manager"];
      if (!defaultRoles.includes(data.role)) {
        // Check if it's a custom role in database
        const customRole = await prisma.role.findUnique({
          where: { name: data.role, isActive: true },
        });
        if (!customRole) {
          throw new Error(`Invalid role: ${data.role}. Role does not exist.`);
        }
      }
    }
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Validate role if provided
    if (data.role !== undefined) {
      const defaultRoles = ["superadmin", "admin", "cashier", "warehouse_manager"];
      if (!defaultRoles.includes(data.role)) {
        // Check if it's a custom role in database
        const customRole = await prisma.role.findUnique({
          where: { name: data.role, isActive: true },
        });
        if (!customRole) {
          throw new Error(`Invalid role: ${data.role}. Role does not exist.`);
        }
      }
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.role !== undefined) updateData.role = data.role;
    if (data.permissions !== undefined) updateData.permissions = data.permissions;
    if (data.profilePicture !== undefined) updateData.profilePicture = data.profilePicture || null;

    if (data.password) {
      updateData.password = await bcrypt.hash(data.password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        name: true,
        email: true,
        role: true,
        permissions: true,
        profilePicture: true,
        createdAt: true,
      },
    });

    return updatedUser;
  }

  // Update profile information only (name, email, profilePicture)
  async updateProfile(
    userId: string,
    userType: "user" | "admin",
    data: {
      name: string;
      email?: string;
      profilePicture?: string;
    }
  ) {
    const updateData: any = {
      name: data.name.trim(),
    };
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.profilePicture !== undefined) updateData.profilePicture = data.profilePicture || null;

    if (userType === "admin") {
      // Update admin user
      const adminUser = await prisma.adminUser.findUnique({
        where: { id: userId },
      });

      if (!adminUser) {
        throw new Error("User not found");
      }

      const updatedUser = await prisma.adminUser.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          role: true,
          profilePicture: true,
          createdAt: true,
        },
      });

      return { ...updatedUser, permissions: [] };
    } else {
      // Update regular user
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error("User not found");
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          role: true,
          permissions: true,
          profilePicture: true,
          createdAt: true,
        },
      });

      return updatedUser;
    }
  }

  // Update password only
  async updatePassword(
    userId: string,
    userType: "user" | "admin",
    data: {
      currentPassword: string;
      newPassword: string;
      confirmPassword: string;
    }
  ) {
    // Verify current password
    if (!data.currentPassword) {
      throw new Error("Current password is required");
    }

    // Verify passwords match
    if (data.newPassword !== data.confirmPassword) {
      throw new Error("Passwords must match");
    }

    if (userType === "admin") {
      // Update admin user password
      const adminUser = await prisma.adminUser.findUnique({
        where: { id: userId },
      });

      if (!adminUser) {
        throw new Error("User not found");
      }

      const isPasswordValid = await bcrypt.compare(data.currentPassword, adminUser.password);
      if (!isPasswordValid) {
        throw new Error("Current password is incorrect");
      }

      // Hash and update password
      const hashedPassword = await bcrypt.hash(data.newPassword, 10);

      await prisma.adminUser.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
        },
      });

      // Send password changed email if email exists
      if (adminUser.email) {
        emailService.sendPasswordChangedEmail(adminUser.email, adminUser.name).catch((err) => {
          logger.error("Failed to send password changed email:", err);
        });
      }
    } else {
      // Update regular user password
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new Error("User not found");
      }

      const isPasswordValid = await bcrypt.compare(data.currentPassword, user.password);
      if (!isPasswordValid) {
        throw new Error("Current password is incorrect");
      }

      // Hash and update password
      const hashedPassword = await bcrypt.hash(data.newPassword, 10);

      await prisma.user.update({
        where: { id: userId },
        data: {
          password: hashedPassword,
        },
      });

      // Send password changed email if email exists
      if (user.email) {
        emailService.sendPasswordChangedEmail(user.email, user.name).catch((err) => {
          logger.error("Failed to send password changed email:", err);
        });
      }
    }

    return { success: true };
  }

  async deleteUser(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new Error("User not found");
    }

    await prisma.user.delete({
      where: { id },
    });
  }

  async canUserModify(targetUserId: string, currentUserId: string, currentUserRole: string) {
    if (targetUserId === currentUserId) {
      return false; // Cannot delete own account
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new Error("User not found");
    }

    // Admin and superadmin can modify regular users
    if (currentUserRole === "admin" || currentUserRole === "superadmin") {
      return true;
    }

    return false;
  }
}

export default new UserService();


