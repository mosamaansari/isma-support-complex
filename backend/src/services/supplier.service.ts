import prisma from "../config/database";

class SupplierService {
  async getSuppliers(search?: string) {
    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50, // Limit to 50 for dropdown
    });

    return suppliers;
  }
}

export default new SupplierService();










