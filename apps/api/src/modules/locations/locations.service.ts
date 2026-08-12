import { Injectable } from '@nestjs/common';
import { Prisma, RackType } from '@prisma/client';
import { conflict, badRequest, notFound } from '../../common/errors';
import { LOCATION_CODES } from '../../common/constants';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { FindLocationLotsQueryDto } from './dto/find-location-lots-query.dto';
import {
  getFallbackRack,
  getProductionRoomRack,
} from '../../common/inventory/rack-location';

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLocationDto) {
    if (dto.createDefaults) {
      return this.createDefaults();
    }

    if (!dto.code || !dto.name || !dto.type) {
      return badRequest('code, name, and type are required', {
        code: dto.code,
        name: dto.name,
        type: dto.type,
      });
    }

    if (dto.type === RackType.WORKER && !dto.workerId) {
      return badRequest('workerId is required for WORKER locations');
    }

    if (dto.type === RackType.WORKER) {
      return badRequest(
        'Rak per mitra sudah tidak dibuat manual; gunakan ruang produksi dan rak order/finished.',
      );
    }

    if (
      (dto.type === RackType.MITRA_ORDER || dto.type === RackType.FINISHED) &&
      !dto.productionRoomId
    ) {
      return badRequest('Rak order/finished harus terikat ke ruang produksi.');
    }

    if (dto.productionRoomId) {
      const room = await this.prisma.productionRoom.findUnique({
        where: { id: dto.productionRoomId },
        select: { id: true },
      });
      if (!room) {
        return notFound('Production room not found', {
          productionRoomId: dto.productionRoomId,
        });
      }
    }

    if (dto.workerId) {
      const worker = await this.prisma.worker.findUnique({
        where: { id: dto.workerId },
      });

      if (!worker) {
        return notFound('Worker not found', { workerId: dto.workerId });
      }
    }

    try {
      return await this.prisma.rackLocation.create({
        data: {
          code: dto.code,
          name: dto.name,
          type: dto.type,
          workerId: null,
          productionRoomId: dto.productionRoomId ?? null,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          return conflict('Location already exists', { code: dto.code });
        }
      }

      throw error;
    }
  }

  async createDefaults() {
    const preSale = await this.prisma.rackLocation.upsert({
      where: { code: LOCATION_CODES.PRE_SALE },
      update: { name: 'Rak Sementara', type: RackType.PRE_SALE },
      create: {
        code: LOCATION_CODES.PRE_SALE,
        name: 'Rak Sementara',
        type: RackType.PRE_SALE,
      },
    });

    const rooms = await this.prisma.productionRoom.findMany({
      select: { id: true },
      orderBy: { code: 'asc' },
    });
    const roomLocations = [] as unknown[];
    for (const room of rooms) {
      roomLocations.push(
        await getProductionRoomRack(this.prisma, room.id, RackType.MITRA_ORDER),
        await getProductionRoomRack(this.prisma, room.id, RackType.FINISHED),
      );
    }

    // Global racks remain only as a compatibility fallback when no room is configured.
    const defaults = [preSale];
    if (rooms.length === 0) {
      defaults.push(
        await getFallbackRack(this.prisma, RackType.MITRA_ORDER),
        await getFallbackRack(this.prisma, RackType.FINISHED),
      );
    }

    return {
      defaults,
      roomLocations,
    };
  }

  async findAll() {
    const hasRooms = (await this.prisma.productionRoom.count()) > 0;
    const where: Prisma.RackLocationWhereInput = hasRooms
      ? {
          AND: [
            { type: { not: RackType.WORKER } },
            {
              OR: [
                { type: { notIn: [RackType.MITRA_ORDER, RackType.FINISHED] } },
                { productionRoomId: { not: null } },
              ],
            },
          ],
        }
      : { type: { not: RackType.WORKER } };

    return this.prisma.rackLocation.findMany({
      where,
      include: {
        worker: true,
        productionRoom: true,
        _count: { select: { lots: true } },
      },
      orderBy: [
        { productionRoom: { code: 'asc' } },
        { type: 'asc' },
        { code: 'asc' },
      ],
    });
  }

  async update(id: string, dto: UpdateLocationDto) {
    const location = await this.prisma.rackLocation.findUnique({
      where: { id },
    });
    if (!location) {
      return notFound('Location not found', { id });
    }
    if (location.type === RackType.WORKER || dto.type === RackType.WORKER) {
      return badRequest(
        'Rak per mitra tidak dapat dibuat atau diubah melalui manajemen rak.',
      );
    }
    if (
      location.productionRoomId &&
      (location.type === RackType.MITRA_ORDER ||
        location.type === RackType.FINISHED)
    ) {
      return badRequest(
        'Rak order/finished ruang produksi dikelola otomatis dari ruang produksi.',
      );
    }
    return this.prisma.rackLocation.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string) {
    const location = await this.prisma.rackLocation.findUnique({
      where: { id },
      include: {
        _count: {
          select: { lots: true, movementsFrom: true, movementsTo: true },
        },
      },
    });
    if (!location) {
      return notFound('Location not found', { id });
    }
    if (location._count.lots > 0) {
      return conflict('Location contains lots and cannot be deleted', { id });
    }
    if (location._count.movementsFrom + location._count.movementsTo > 0) {
      return conflict(
        'Lokasi memiliki riwayat perpindahan dan tidak dapat dihapus',
        { id },
      );
    }
    if (
      location.productionRoomId &&
      (location.type === RackType.MITRA_ORDER ||
        location.type === RackType.FINISHED)
    ) {
      return conflict(
        'Rak canonical ruang produksi tidak dapat dihapus dari menu ini',
        { id },
      );
    }
    await this.prisma.rackLocation.delete({ where: { id } });
    return { success: true };
  }

  async findLots(locationId: string) {
    const location = await this.prisma.rackLocation.findUnique({
      where: { id: locationId },
    });

    if (!location) {
      return notFound('Location not found', { locationId });
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
      orderBy: { createdAt: 'asc' },
    });

    return {
      location,
      lots,
    };
  }

  async findLotsByCode(code: string) {
    const location = await this.ensureLocationByCode(code);
    const aggregateType = this.getAggregateRackType(code, location);

    const lots = await this.prisma.productionLot.findMany({
      where: aggregateType
        ? { location: { type: aggregateType } }
        : { locationId: location.id },
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
      orderBy: { createdAt: 'asc' },
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
      ...(this.getAggregateRackType(code, location)
        ? { location: { type: this.getAggregateRackType(code, location)! } }
        : { locationId: location.id }),
    };

    if (search) {
      where.OR = [
        { lotNumber: { contains: search, mode: 'insensitive' } },
        { externalId: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (query.gradeId) {
      where.gradeId = query.gradeId;
    }

    if (query.printed === 'printed') {
      where.printedAt = { not: null };
    }

    if (query.printed === 'unprinted') {
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
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
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
    if (code === LOCATION_CODES.MITRA_ORDER) {
      const roomRack = await this.prisma.rackLocation.findFirst({
        where: {
          type: RackType.MITRA_ORDER,
          productionRoomId: { not: null },
        },
        orderBy: { code: 'asc' },
      });
      if (roomRack) return roomRack;
    }

    if (code === LOCATION_CODES.FINISHED) {
      const roomRack = await this.prisma.rackLocation.findFirst({
        where: {
          type: RackType.FINISHED,
          productionRoomId: { not: null },
        },
        orderBy: { code: 'asc' },
      });
      if (roomRack) return roomRack;
    }

    if (code === LOCATION_CODES.PRE_SALE) {
      return this.prisma.rackLocation.upsert({
        where: { code: LOCATION_CODES.PRE_SALE },
        update: { name: 'Rak Sementara', type: RackType.PRE_SALE },
        create: {
          code: LOCATION_CODES.PRE_SALE,
          name: 'Rak Sementara',
          type: RackType.PRE_SALE,
        },
      });
    }

    if (code === LOCATION_CODES.MITRA_ORDER) {
      return this.prisma.rackLocation.upsert({
        where: { code: LOCATION_CODES.MITRA_ORDER },
        update: { name: 'Rak Mitra Order', type: RackType.MITRA_ORDER },
        create: {
          code: LOCATION_CODES.MITRA_ORDER,
          name: 'Rak Mitra Order',
          type: RackType.MITRA_ORDER,
        },
      });
    }

    if (code === LOCATION_CODES.FINISHED) {
      return this.prisma.rackLocation.upsert({
        where: { code: LOCATION_CODES.FINISHED },
        update: { name: 'Rak Finished', type: RackType.FINISHED },
        create: {
          code: LOCATION_CODES.FINISHED,
          name: 'Rak Finished',
          type: RackType.FINISHED,
        },
      });
    }

    return badRequest('Unknown location code', { code });
  }

  private getAggregateRackType(
    code: string,
    location: { code: string; productionRoomId: string | null },
  ) {
    if (location.productionRoomId) {
      if (code === LOCATION_CODES.MITRA_ORDER) return RackType.MITRA_ORDER;
      if (code === LOCATION_CODES.FINISHED) return RackType.FINISHED;
    }
    return null;
  }
}
