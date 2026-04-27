import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { badRequest, conflict, notFound } from "../../common/errors";
import { CreateBarangJadiDto } from "./dto/create-barang-jadi.dto";
import { UpdateBarangJadiDto } from "./dto/update-barang-jadi.dto";
import { CreateByProductTypeDto } from "./dto/create-by-product-type.dto";
import { UpdateByProductTypeDto } from "./dto/update-by-product-type.dto";
import { CreateResultGradeTypeDto } from "./dto/create-result-grade-type.dto";
import { UpdateResultGradeTypeDto } from "./dto/update-result-grade-type.dto";

@Injectable()
export class BarangJadiService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeName(name: string) {
    return name.trim().toUpperCase();
  }

  private async resolveByProductTypes(byProductTypeIds: string[]) {
    const normalizedIds = Array.from(new Set(byProductTypeIds));

    if (normalizedIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.byProductType.findMany({
      where: {
        id: { in: normalizedIds },
      },
      orderBy: { name: "asc" },
    });

    if (rows.length !== normalizedIds.length) {
      return notFound("Ada komponen by product yang tidak ditemukan", {
        requested: normalizedIds.length,
        found: rows.length,
      });
    }

    return rows;
  }

  private async resolveResultGradeTypes(resultGradeTypeIds: string[]) {
    const normalizedIds = Array.from(new Set(resultGradeTypeIds));

    if (normalizedIds.length === 0) {
      return [];
    }

    const rows = await this.prisma.barangJadiGradeType.findMany({
      where: {
        id: { in: normalizedIds },
      },
      orderBy: { name: "asc" },
    });

    if (rows.length !== normalizedIds.length) {
      return notFound("Ada grade hasil barang jadi yang tidak ditemukan", {
        requested: normalizedIds.length,
        found: rows.length,
      });
    }

    return rows;
  }

  findAll() {
    return this.prisma.barangJadi.findMany({
      include: {
        byProducts: {
          include: {
            byProductType: true,
          },
          orderBy: {
            byProductType: {
              name: "asc",
            },
          },
        },
        resultGrades: {
          include: {
            resultGradeType: true,
          },
          orderBy: {
            resultGradeType: {
              name: "asc",
            },
          },
        },
      },
      orderBy: { name: "asc" },
    }).then((rows) =>
      rows.map((row) => ({
        ...row,
        byProducts: row.byProducts.map((item) => item.byProductType),
        resultGrades: row.resultGrades.map((item) => item.resultGradeType),
      })),
    );
  }

  findAllByProductTypes() {
    return this.prisma.byProductType.findMany({
      orderBy: { name: "asc" },
    });
  }

  findAllResultGradeTypes() {
    return this.prisma.barangJadiGradeType.findMany({
      orderBy: { name: "asc" },
    });
  }

  async createByProductType(dto: CreateByProductTypeDto) {
    const normalizedName = this.normalizeName(dto.name);
    if (!normalizedName) {
      return badRequest('Nama by product wajib diisi');
    }

    const existing = await this.prisma.byProductType.findFirst({
      where: {
        name: {
          equals: normalizedName,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      return conflict('Nama by product sudah ada', {
        byProductTypeId: existing.id,
        name: existing.name,
      });
    }

    return this.prisma.byProductType.create({
      data: {
        name: normalizedName,
      },
    });
  }

  async create(dto: CreateBarangJadiDto) {
    const normalizedName = this.normalizeName(dto.name);
    if (!normalizedName) {
      return badRequest("Nama barang jadi wajib diisi");
    }

    const byProductTypes = await this.resolveByProductTypes(dto.byProductTypeIds);
    const resultGradeTypes = await this.resolveResultGradeTypes(dto.resultGradeTypeIds);

    const existing = await this.prisma.barangJadi.findFirst({
      where: {
        name: {
          equals: normalizedName,
          mode: "insensitive",
        },
      },
    });

    if (existing) {
      return conflict("Nama barang jadi sudah ada", {
        barangJadiId: existing.id,
        name: existing.name,
      });
    }

    return this.prisma.barangJadi.create({
      data: {
        name: normalizedName,
        byProductKeys: byProductTypes.map((item) => item.name),
        byProducts: {
          create: byProductTypes.map((item) => ({
            byProductTypeId: item.id,
          })),
        },
        resultGrades: {
          create: resultGradeTypes.map((item) => ({
            resultGradeTypeId: item.id,
          })),
        },
      },
      include: {
        byProducts: {
          include: {
            byProductType: true,
          },
          orderBy: {
            byProductType: {
              name: "asc",
            },
          },
        },
        resultGrades: {
          include: {
            resultGradeType: true,
          },
          orderBy: {
            resultGradeType: {
              name: "asc",
            },
          },
        },
      },
    }).then((row) => ({
      ...row,
      byProducts: row.byProducts.map((item) => item.byProductType),
      resultGrades: row.resultGrades.map((item) => item.resultGradeType),
    }));
  }

  async createResultGradeType(dto: CreateResultGradeTypeDto) {
    const normalizedName = this.normalizeName(dto.name);
    if (!normalizedName) {
      return badRequest("Nama grade hasil wajib diisi");
    }

    const existing = await this.prisma.barangJadiGradeType.findFirst({
      where: {
        name: {
          equals: normalizedName,
          mode: "insensitive",
        },
      },
    });

    if (existing) {
      return conflict("Nama grade hasil sudah ada", {
        resultGradeTypeId: existing.id,
        name: existing.name,
      });
    }

    return this.prisma.barangJadiGradeType.create({
      data: {
        name: normalizedName,
      },
    });
  }

  async updateByProductType(id: string, dto: UpdateByProductTypeDto) {
    const existing = await this.prisma.byProductType.findUnique({
      where: { id },
    });

    if (!existing) {
      return notFound('By product tidak ditemukan', { id });
    }

    const normalizedName = this.normalizeName(dto.name);
    if (!normalizedName) {
      return badRequest('Nama by product wajib diisi');
    }

    const duplicate = await this.prisma.byProductType.findFirst({
      where: {
        id: { not: id },
        name: {
          equals: normalizedName,
          mode: 'insensitive',
        },
      },
    });

    if (duplicate) {
      return conflict('Nama by product sudah ada', {
        byProductTypeId: duplicate.id,
        name: duplicate.name,
      });
    }

    return this.prisma.byProductType.update({
      where: { id },
      data: {
        name: normalizedName,
      },
    });
  }

  async update(id: string, dto: UpdateBarangJadiDto) {
    const existing = await this.prisma.barangJadi.findUnique({
      where: { id },
    });

    if (!existing) {
      return notFound("Barang jadi tidak ditemukan", { id });
    }

    const normalizedName = this.normalizeName(dto.name);
    if (!normalizedName) {
      return badRequest("Nama barang jadi wajib diisi");
    }

    const byProductTypes = await this.resolveByProductTypes(dto.byProductTypeIds);
    const resultGradeTypes = await this.resolveResultGradeTypes(dto.resultGradeTypeIds);

    const duplicate = await this.prisma.barangJadi.findFirst({
      where: {
        id: { not: id },
        name: {
          equals: normalizedName,
          mode: "insensitive",
        },
      },
    });

    if (duplicate) {
      return conflict("Nama barang jadi sudah ada", {
        barangJadiId: duplicate.id,
        name: duplicate.name,
      });
    }

    return this.prisma.barangJadi.update({
      where: { id },
      data: {
        name: normalizedName,
        byProductKeys: byProductTypes.map((item) => item.name),
        byProducts: {
          deleteMany: {},
          create: byProductTypes.map((item) => ({
            byProductTypeId: item.id,
          })),
        },
        resultGrades: {
          deleteMany: {},
          create: resultGradeTypes.map((item) => ({
            resultGradeTypeId: item.id,
          })),
        },
      },
      include: {
        byProducts: {
          include: {
            byProductType: true,
          },
          orderBy: {
            byProductType: {
              name: "asc",
            },
          },
        },
        resultGrades: {
          include: {
            resultGradeType: true,
          },
          orderBy: {
            resultGradeType: {
              name: "asc",
            },
          },
        },
      },
    }).then((row) => ({
      ...row,
      byProducts: row.byProducts.map((item) => item.byProductType),
      resultGrades: row.resultGrades.map((item) => item.resultGradeType),
    }));
  }

  async updateResultGradeType(id: string, dto: UpdateResultGradeTypeDto) {
    const existing = await this.prisma.barangJadiGradeType.findUnique({
      where: { id },
    });

    if (!existing) {
      return notFound("Grade hasil tidak ditemukan", { id });
    }

    const normalizedName = this.normalizeName(dto.name);
    if (!normalizedName) {
      return badRequest("Nama grade hasil wajib diisi");
    }

    const duplicate = await this.prisma.barangJadiGradeType.findFirst({
      where: {
        id: { not: id },
        name: {
          equals: normalizedName,
          mode: "insensitive",
        },
      },
    });

    if (duplicate) {
      return conflict("Nama grade hasil sudah ada", {
        resultGradeTypeId: duplicate.id,
        name: duplicate.name,
      });
    }

    return this.prisma.barangJadiGradeType.update({
      where: { id },
      data: {
        name: normalizedName,
      },
    });
  }

  async removeByProductType(id: string) {
    const existing = await this.prisma.byProductType.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            barangJadis: true,
          },
        },
      },
    });

    if (!existing) {
      return notFound('By product tidak ditemukan', { id });
    }

    if (existing._count.barangJadis > 0) {
      return conflict('By product sudah dipakai pada barang jadi', {
        id,
        usedInBarangJadi: existing._count.barangJadis,
      });
    }

    return this.prisma.byProductType.delete({
      where: { id },
    });
  }

  async removeResultGradeType(id: string) {
    const existing = await this.prisma.barangJadiGradeType.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            barangJadis: true,
            finishReceipts: true,
          },
        },
      },
    });

    if (!existing) {
      return notFound("Grade hasil tidak ditemukan", { id });
    }

    if (existing._count.barangJadis > 0 || existing._count.finishReceipts > 0) {
      return conflict("Grade hasil sudah dipakai", {
        id,
        usedInBarangJadi: existing._count.barangJadis,
        usedInReceipts: existing._count.finishReceipts,
      });
    }

    return this.prisma.barangJadiGradeType.delete({
      where: { id },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.barangJadi.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            finishReceipts: true,
          },
        },
      },
    });

    if (!existing) {
      return notFound("Barang jadi tidak ditemukan", { id });
    }

    if (existing._count.finishReceipts > 0) {
      return conflict("Barang jadi sudah dipakai pada data setoran", {
        id,
        usedInReceipts: existing._count.finishReceipts,
      });
    }

    return this.prisma.barangJadi.delete({
      where: { id },
    });
  }
}
