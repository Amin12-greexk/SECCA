import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateWorkerDto } from './dto/create-worker.dto';
import { UpdateWorkerDto } from './dto/update-worker.dto';
import { badRequest, conflict, notFound } from '../../common/errors';

type WeeklyBucket = {
  weekStart: Date;
  weekEnd: Date;
  totalDryInGram: number;
  totalMainOutGram: number;
  totalByProductGram: number;
  totalAmountRp: number;
  items: number;
};

@Injectable()
export class WorkersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWorkerDto) {
    const normalizedPin = dto.pin ? this.normalizePin(dto.pin) : null;
    if (normalizedPin) {
      const owner = await this.prisma.worker.findUnique({
        where: { pin: normalizedPin },
        select: { id: true },
      });
      if (owner) {
        return conflict('PIN sudah digunakan oleh worker lain', {
          pin: normalizedPin,
        });
      }
    }

    const trainerRoom = dto.trainerId
      ? await this.prisma.appUser.findUnique({
          where: { id: dto.trainerId },
          select: { productionRoomId: true },
        })
      : null;

    try {
      return await this.prisma.worker.create({
        data: {
          name: dto.name,
          code: dto.code,
          pin: normalizedPin,
          capacityGram: dto.capacityGram ?? null,
          trainerId: dto.trainerId ?? null,
          productionRoomId:
            trainerRoom?.productionRoomId ?? dto.productionRoomId ?? null,
          isMiniplant: dto.isMiniplant ?? false,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          return conflict('PIN sudah digunakan oleh worker lain', {
            pin: normalizedPin,
          });
        }
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdateWorkerDto) {
    const worker = await this.prisma.worker.findUnique({
      where: { id },
      select: { id: true, trainerId: true, productionRoomId: true },
    });

    if (!worker) {
      return notFound('Worker not found', { workerId: id });
    }

    // Resolve the trainer that will be effective after this update. A worker
    // assigned to a trainer must inherit that trainer's production room.
    const nextTrainerId =
      dto.trainerId !== undefined ? dto.trainerId : worker.trainerId;
    let trainerRoomId: string | null | undefined;
    if (nextTrainerId) {
      const trainer = await this.prisma.appUser.findUnique({
        where: { id: nextTrainerId },
        select: { id: true, productionRoomId: true },
      });
      if (!trainer) {
        return badRequest('Trainer tidak ditemukan', {
          trainerId: nextTrainerId,
        });
      }
      trainerRoomId = trainer.productionRoomId;
    }

    const data: {
      name?: string;
      code?: string | null;
      pin?: string | null;
      capacityGram?: number | null;
      trainerId?: string | null;
      productionRoomId?: string | null;
      isMiniplant?: boolean;
    } = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.code !== undefined) data.code = dto.code;
    if (dto.pin !== undefined) {
      const normalizedPin = dto.pin ? this.normalizePin(dto.pin) : null;
      if (normalizedPin) {
        const owner = await this.prisma.worker.findUnique({
          where: { pin: normalizedPin },
          select: { id: true },
        });
        if (owner && owner.id !== id) {
          return conflict('PIN sudah digunakan oleh worker lain', {
            pin: normalizedPin,
          });
        }
      }
      data.pin = normalizedPin;
    }
    if (dto.capacityGram !== undefined) data.capacityGram = dto.capacityGram;
    if (dto.trainerId !== undefined) data.trainerId = dto.trainerId;
    if (nextTrainerId) {
      data.productionRoomId = trainerRoomId ?? null;
    } else if (dto.productionRoomId !== undefined) {
      data.productionRoomId = dto.productionRoomId;
    }
    if (dto.isMiniplant !== undefined) data.isMiniplant = dto.isMiniplant;

    try {
      return await this.prisma.worker.update({
        where: { id },
        data,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          return conflict('PIN sudah digunakan oleh worker lain');
        }
      }
      throw error;
    }
  }

  findAll() {
    return this.prisma.worker.findMany({
      include: {
        rackLocation: true,
        productionRoom: true,
        trainer: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getWeeklyStats(workerId: string, weeks = 6) {
    if (!workerId) {
      return badRequest('workerId is required');
    }

    const worker = await this.prisma.worker.findUnique({
      where: { id: workerId },
      select: { id: true, name: true, capacityGram: true },
    });

    if (!worker) {
      return notFound('Worker not found', { workerId });
    }

    const safeWeeks = Math.max(
      1,
      Math.min(12, Number.isFinite(weeks) ? weeks : 6),
    );
    const now = new Date();
    const startOfWeek = (date: Date) => {
      const start = new Date(date);
      const day = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      return start;
    };

    const currentWeekStart = startOfWeek(now);
    const rangeStart = new Date(currentWeekStart);
    rangeStart.setDate(rangeStart.getDate() - (safeWeeks - 1) * 7);
    const rangeEnd = new Date(currentWeekStart);
    rangeEnd.setDate(rangeEnd.getDate() + 7);

    const receipts = await this.prisma.finishReceipt.findMany({
      where: {
        returnedAt: { gte: rangeStart, lt: rangeEnd },
        workOrderItem: {
          workOrder: { workerId },
        },
      },
      include: {
        workOrderItem: {
          include: { payrollEntry: true },
        },
      },
    });

    const buckets: WeeklyBucket[] = Array.from({ length: safeWeeks }).map(
      (_, index) => {
        const weekStart = new Date(rangeStart);
        weekStart.setDate(rangeStart.getDate() + index * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);
        return {
          weekStart,
          weekEnd,
          totalDryInGram: 0,
          totalMainOutGram: 0,
          totalByProductGram: 0,
          totalAmountRp: 0,
          items: 0,
        };
      },
    );

    const weekMs = 7 * 24 * 60 * 60 * 1000;
    receipts.forEach((receipt) => {
      const diff = receipt.returnedAt.getTime() - rangeStart.getTime();
      const index = Math.floor(diff / weekMs);
      const bucket = buckets[index];
      if (!bucket) return;
      bucket.items += 1;
      bucket.totalDryInGram += receipt.dryInGram;
      bucket.totalMainOutGram += receipt.mainOutWeightGram;
      bucket.totalByProductGram += receipt.byProductWeightGram;
      bucket.totalAmountRp += receipt.workOrderItem.payrollEntry?.amountRp ?? 0;
    });

    return {
      worker,
      weeks: buckets,
    };
  }

  private normalizePin(pin: string) {
    return pin.replace(/\D/g, '');
  }
}
