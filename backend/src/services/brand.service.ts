import prisma from "../config/database";
import logger from "../utils/logger";

class BrandService {
  async getBrands() {
    const brands = await prisma.brand.findMany({
      orderBy: { createdAt: "desc" },
    });

    return brands;
  }

  async getBrand(id: string) {
    const brand = await prisma.brand.findUnique({
      where: { id },
    });

    if (!brand) {
      throw new Error("Brand not found");
    }

    return brand;
  }

  async createBrand(data: { name: string; description?: string }) {
    // Check if brand already exists
    const existingBrand = await prisma.brand.findUnique({
      where: { name: data.name.trim() },
    });

    if (existingBrand) {
      throw new Error("Brand already exists");
    }

    const brand = await prisma.brand.create({
      data: {
        name: data.name.trim(),
        description: data.description?.trim() || null,
      },
    });

    return brand;
  }

  async updateBrand(id: string, data: { name?: string; description?: string }) {
    const brand = await prisma.brand.findUnique({
      where: { id },
    });

    if (!brand) {
      throw new Error("Brand not found");
    }

    // Check if name is being changed and if new name already exists
    if (data.name && data.name.trim() !== brand.name) {
      const existingBrand = await prisma.brand.findUnique({
        where: { name: data.name.trim() },
      });

      if (existingBrand) {
        throw new Error("Brand name already exists");
      }
    }

    const updateData: any = {};
    if (data.name !== undefined) updateData.name = data.name.trim();
    if (data.description !== undefined) updateData.description = data.description?.trim() || null;

    const updatedBrand = await prisma.brand.update({
      where: { id },
      data: updateData,
    });

    return updatedBrand;
  }

  async deleteBrand(id: string) {
    const brand = await prisma.brand.findUnique({
      where: { id },
      include: {
        products: true,
      },
    });

    if (!brand) {
      throw new Error("Brand not found");
    }

    // Check if brand is being used by any products
    if (brand.products.length > 0) {
      throw new Error(
        `Cannot delete brand. It is being used by ${brand.products.length} product(s)`
      );
    }

    await prisma.brand.delete({
      where: { id },
    });
  }
}

export default new BrandService();


