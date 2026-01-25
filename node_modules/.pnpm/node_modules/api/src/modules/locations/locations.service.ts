import { Injectable } from "@nestjs/common";
import { Prisma, RackType } from "@prisma/client";
import { conflict, badRequest, notFound } from "../../common/errors";
import { LOCATION_CODES, workerRackCode } from "../../common/constants";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateLocationDto } from "./dto/create-location.dto";

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
      defaults: [preSale, finished],
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
      include: { grade: true },
      orderBy: { createdAt: "asc" },
    });

    return {
      location,
      lots,
    };
  }
}
