import { Injectable } from "@nestjs/common";
import { Prisma, RackType } from "@prisma/client";
import { conflict, badRequest, notFound } from "../../common/errors";
import { LOCATION_CODES, workerRackCode } from "../../common/constants";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateLocationDto } from "./dto/create-location.dto";
import { FindLocationLotsQueryDto } from "./dto/find-location-lots-query.dto";

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLocationDto) {
    if (dto.createDefaults) {
      return this.createDefaults();
    }

    if (!dto.code || !dto.name || !dto.type) {
      return badRequest("code, name, and type are required", {
        code: dto.code,
        name: dto.name,
        type: dto.type,
      });
    }

    if (dto.type === RackType.WORKER && !dto.workerId) {
      return badRequest("workerId is required for WORKER locations");
    }

    if (dto.workerId) {
      const worker = await this.prisma.worker.findUnique({
        where: { id: dto.workerId },
      });

      if (!worker) {
        return notFound("Worker not found", { workerId: dto.workerId });
      }
    }

    try {
      return await this.prisma.rackLocation.create({
        data: {
          code: dto.code,
          name: dto.name,
          type: dto.type,
          workerId: dto.type === RackType.WORKER ? dto.workerId : null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") {
          return conflict("Location already exists", { code: dto.code });
        }
      }

      throw error;
    }
  }

  async createDefaults() {
    const preSale = await this.prisma.rackLocation.upsert({
      where: { code: LOCATION_CODES.PRE_SALE },
      update: { name: "Rak Sementara", type: RackType.PRE_SALE },
      create: {
        code: LOCATION_CODES.PRE_SALE,
        name: "Rak Sementara",
        type: RackType.PRE_SALE,
      },
    });

    const mitraOrder = await this.prisma.rackLocation.upsert({
      where: { code: LOCATION_CODES.MITRA_ORDER },
      update: { name: "Rak Mitra Order", type: RackType.MITRA_ORDER },
      create: {
        code: LOCATION_CODES.MITRA_ORDER,
        name: "Rak Mitra Order",
        type: RackType.MITRA_ORDER,
      },
    });

    const finished = await this.prisma.rackLocation.upsert({
      where: { code: LOCATION_CODES.FINISHED },
      update: { name: "Rak Finished", type: RackType.FINISHED },
      create: {
        code: LOCATION_CODES.FINISHED,
        name: "Rak Finished",
        type: RackType.FINISHED,
      },
    });

    const workers = await this.prisma.worker.findMany({
      orderBy: { createdAt: "asc" },
    });

    const workerLocations = [] as unknown[];
    for (const worker of workers) {
      const location = await this.prisma.rackLocation.upsert({
        where: { workerId: worker.id },
        update: {
          code: workerRackCode(worker.id),
          name: `Rak Mitra - ${worker.name}`,
          type: RackType.WORKER,
        },
        create: {
          code: workerRackCode(worker.id),
          name: `Rak Mitra - ${worker.name}`,
          type: RackType.WORKER,
          workerId: worker.id,
        },
      });
      workerLocations.push(location);
    }

    return {
      defaults: [preSale, mitraOrder, finished],
      workerLocations,
    };
  }

  findAll() {
    return this.prisma.rackLocation.findMany({
      include: { worker: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async findLots(locationId: string) {
    const location = await this.prisma.rackLocation.findUnique({
      where: { id: locationId },
    });

    if (!location) {
      return notFound("Location not found", { locationId });
    }

    const lots = await this.prisma.productionLot.findMany({
      where: { locationId },
      include: {
        grade: true,
        featherGrade: true,
        colorGrade: true,
        workItem: {
          select: {
            id: true,
            status: true,
            lane: true,
            workOrder: {
              select: {
                id: true,
                workerId: true,
                worker: {
                  select: { id: true, name: true, code: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      location,
      lots,
    };
  }

  async findLotsByCode(code: string) {
    const location = await this.ensureLocationByCode(code);

    const lots = await this.prisma.productionLot.findMany({
      where: { locationId: location.id },
      include: {
        grade: true,
        featherGrade: true,
        colorGrade: true,
        workItem: {
          select: {
            id: true,
            status: true,
            lane: true,
            workOrder: {
              select: {
                id: true,
                workerId: true,
                worker: {
                  select: { id: true, name: true, code: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    return {
      location,
      lots,
    };
  }

  async findLotsByCodePaginated(code: string, query: FindLocationLotsQueryDto) {
    const location = await this.ensureLocationByCode(code);

    const limit = query.limit ?? 100;
    const requestedPage = query.page ?? 1;
    const page = Math.max(1, requestedPage);
    const search = query.search?.trim();

    const where: Prisma.ProductionLotWhereInput = {
      locationId: location.id,
    };

    if (search) {
      where.OR = [
        { lotNumber: { contains: search, mode: "insensitive" } },
        { externalId: { contains: search, mode: "insensitive" } },
      ];
    }

    if (query.gradeId) {
      where.gradeId = query.gradeId;
    }

    if (query.printed === "printed") {
      where.printedAt = { not: null };
    }

    if (query.printed === "unprinted") {
      where.printedAt = null;
    }

    const [total, aggregate] = await this.prisma.$transaction([
      this.prisma.productionLot.count({ where }),
      this.prisma.productionLot.aggregate({
        where,
        _sum: { wetWeightGram: true },
      }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * limit;

    const lots = await this.prisma.productionLot.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        lotNumber: true,
        externalId: true,
        gradeId: true,
        featherGradeId: true,
        colorGradeId: true,
        wetWeightGram: true,
        dryWeightGramLocked: true,
        moistureBps: true,
        status: true,
        locationId: true,
        printedAt: true,
        createdAt: true,
        updatedAt: true,
        grade: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
        featherGrade: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
        colorGrade: {
          select: {
            id: true,
            name: true,
            code: true,
            type: true,
          },
        },
        workItem: {
          select: {
            id: true,
            status: true,
            lane: true,
            workOrder: {
              select: {
                id: true,
                workerId: true,
                worker: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return {
      location,
      lots,
      page: safePage,
      limit,
      total,
      totalPages,
      totalWetWeightGram: aggregate._sum.wetWeightGram ?? 0,
    };
  }

  private async ensureLocationByCode(code: string) {
    if (code === LOCATION_CODES.PRE_SALE) {
      return this.prisma.rackLocation.upsert({
        where: { code: LOCATION_CODES.PRE_SALE },
        update: { name: "Rak Sementara", type: RackType.PRE_SALE },
        create: {
          code: LOCATION_CODES.PRE_SALE,
          name: "Rak Sementara",
          type: RackType.PRE_SALE,
        },
      });
    }

    if (code === LOCATION_CODES.MITRA_ORDER) {
      return this.prisma.rackLocation.upsert({
        where: { code: LOCATION_CODES.MITRA_ORDER },
        update: { name: "Rak Mitra Order", type: RackType.MITRA_ORDER },
        create: {
          code: LOCATION_CODES.MITRA_ORDER,
          name: "Rak Mitra Order",
          type: RackType.MITRA_ORDER,
        },
      });
    }

    if (code === LOCATION_CODES.FINISHED) {
      return this.prisma.rackLocation.upsert({
        where: { code: LOCATION_CODES.FINISHED },
        update: { name: "Rak Finished", type: RackType.FINISHED },
        create: {
          code: LOCATION_CODES.FINISHED,
          name: "Rak Finished",
          type: RackType.FINISHED,
        },
      });
    }

    return badRequest("Unknown location code", { code });
  }
}
