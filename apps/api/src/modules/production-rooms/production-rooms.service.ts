import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { badRequest, notFound } from '../../common/errors';
import { CreateProductionRoomDto } from './dto/create-production-room.dto';
import { UpdateProductionRoomDto } from './dto/update-production-room.dto';
import { RoomType, RackType } from '@prisma/client';
import { getProductionRoomRack } from '../../common/inventory/rack-location';

@Injectable()
export class ProductionRoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProductionRoomDto) {
    const existing = await this.prisma.productionRoom.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      return badRequest('Room code already exists');
    }

    return this.prisma.$transaction(async (tx) => {
      const room = await tx.productionRoom.create({
        data: {
          code: dto.code,
          name: dto.name,
          type: dto.type,
        },
      });

      await getProductionRoomRack(tx, room.id, RackType.MITRA_ORDER);
      await getProductionRoomRack(tx, room.id, RackType.FINISHED);

      return room;
    });
  }

  async findAll() {
    return this.prisma.productionRoom.findMany({
      include: {
        _count: {
          select: { workers: true, lots: true, rackLocations: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const room = await this.prisma.productionRoom.findUnique({
      where: { id },
      include: {
        _count: {
          select: { workers: true, lots: true, rackLocations: true },
        },
      },
    });
    if (!room) return notFound('Production room not found');
    return room;
  }

  async update(id: string, dto: UpdateProductionRoomDto) {
    const room = await this.prisma.productionRoom.findUnique({ where: { id } });
    if (!room) return notFound('Production room not found');

    if (dto.code && dto.code !== room.code) {
      const existing = await this.prisma.productionRoom.findUnique({
        where: { code: dto.code },
      });
      if (existing) return badRequest('Room code already exists');
    }

    return this.prisma.$transaction(async (tx) => {
      const nextCode = dto.code ?? room.code;
      const nextName = dto.name ?? room.name;
      const existingRacks = await tx.rackLocation.findMany({
        where: {
          productionRoomId: id,
          type: { in: [RackType.MITRA_ORDER, RackType.FINISHED] },
        },
        select: { id: true, type: true },
      });

      const updated = await tx.productionRoom.update({
        where: { id },
        data: dto,
      });

      for (const rack of existingRacks) {
        const finished = rack.type === RackType.FINISHED;
        await tx.rackLocation.update({
          where: { id: rack.id },
          data: {
            code: `${finished ? 'RAK_FINISHED' : 'RAK_MITRA_ORDER'}_${nextCode}`,
            name: `${finished ? 'Rak Finished' : 'Rak Mitra Order'} - ${nextName}`,
          },
        });
      }

      // Keep both canonical racks present even if one was manually removed.
      await getProductionRoomRack(tx, updated.id, RackType.MITRA_ORDER);
      await getProductionRoomRack(tx, updated.id, RackType.FINISHED);

      return updated;
    });
  }

  async delete(id: string) {
    const room = await this.prisma.productionRoom.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            workers: true,
            lots: true,
            rackLocations: true,
          },
        },
      },
    });
    if (!room) return notFound('Production room not found');

    if (room._count.workers > 0 || room._count.lots > 0) {
      return badRequest('Cannot delete room with active workers or lots');
    }

    const rackIds = await this.prisma.rackLocation.findMany({
      where: { productionRoomId: id },
      select: { id: true },
    });
    if (rackIds.length > 0) {
      const movementCount = await this.prisma.inventoryMovement.count({
        where: {
          OR: [
            { fromLocationId: { in: rackIds.map((rack) => rack.id) } },
            { toLocationId: { in: rackIds.map((rack) => rack.id) } },
          ],
        },
      });
      if (movementCount > 0) {
        return badRequest(
          'Ruang produksi memiliki riwayat perpindahan rak dan tidak dapat dihapus',
        );
      }
    }

    await this.prisma.rackLocation.deleteMany({
      where: { productionRoomId: id },
    });

    return this.prisma.productionRoom.delete({ where: { id } });
  }

  async ensureDefaultRooms() {
    const count = await this.prisma.productionRoom.count();
    if (count > 0) return;

    const defaults = [
      { code: 'RP1', name: 'Ruang Produksi 1', type: RoomType.FACTORY },
      { code: 'RP2', name: 'Ruang Produksi 2', type: RoomType.FACTORY },
      { code: 'MINIPLANT1', name: 'Miniplant 1', type: RoomType.MINIPLANT },
    ];

    for (const d of defaults) {
      await this.create(d);
    }
  }
}
