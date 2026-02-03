import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { Prisma } from "@prisma/client";
import { conflict, notFound } from "../../common/errors";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) { }

  create(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({
      data: {
        name: dto.name,
        code: dto.code,
        phone: dto.phone,
      },
    });
  }

  findAll() {
    return this.prisma.supplier.findMany({
      orderBy: { createdAt: "asc" },
    });
  }

  async update(id: string, dto: UpdateSupplierDto) {
    const existing = await this.prisma.supplier.findUnique({
      where: { id },
    });

    if (!existing) {
      return notFound("Supplier not found", { supplierId: id });
    }

    return this.prisma.supplier.update({
      where: { id },
      data: {
        name: dto.name,
        code: dto.code,
        phone: dto.phone,
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.supplier.findUnique({
      where: { id },
    });

    if (!existing) {
      return notFound("Supplier not found", { supplierId: id });
    }

    try {
      return await this.prisma.supplier.delete({
        where: { id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2003") {
          return conflict("Supplier is in use and cannot be deleted", { supplierId: id });
        }
      }
      throw error;
    }
  }
}
