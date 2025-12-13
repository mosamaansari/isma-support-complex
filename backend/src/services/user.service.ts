import bcrypt from "bcryptjs";
import prisma from "../config/database";
import logger from "../utils/logger";

class UserService {
  async getUsers() {
    const users = await prisma.user.findMany({
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
    });

    return users;
  }

  async getUser(id: string) {
    const user = await prisma.user.findUnique({
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
    // Only allow cashier and warehouse_manager roles
    if (data.role !== "cashier" && data.role !== "warehouse_manager") {
      throw new Error("Invalid role. Only cashier and warehouse_manager are allowed");
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
        role: data.role as any,
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
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Only allow cashier and warehouse_manager roles
    if (data.role && data.role !== "cashier" && data.role !== "warehouse_manager") {
      throw new Error("Invalid role. Only cashier and warehouse_manager are allowed");
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.role !== undefined) updateData.role = data.role as any;
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

  async updateProfile(
    userId: string,
    data: {
      name?: string;
      email?: string;
      password?: string;
      currentPassword?: string;
      profilePicture?: string;
    }
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.email !== undefined) updateData.email = data.email || null;
    if (data.profilePicture !== undefined) updateData.profilePicture = data.profilePicture || null;

    // If password is being changed, verify current password first
    if (data.password) {
      if (!data.currentPassword) {
        throw new Error("Current password is required to change password");
      }

      const isPasswordValid = await bcrypt.compare(data.currentPassword, user.password);
      if (!isPasswordValid) {
        throw new Error("Current password is incorrect");
      }

      updateData.password = await bcrypt.hash(data.password, 10);
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


