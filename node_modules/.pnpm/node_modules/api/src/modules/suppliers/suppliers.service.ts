import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateSupplierDto } from "./dto/create-supplier.dto";

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

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
}
