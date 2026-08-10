import { Injectable } from '@nestjs/common';
import { MitraOrderRequestStatus, Prisma } from '@prisma/client';
import {
  badRequest,
  conflict,
  notFound,
  unprocessable,
} from '../../common/errors';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMitraOrderRequestDto } from './dto/create-mitra-order-request.dto';
import { CreateTrainerBulkOrderDto } from './dto/create-trainer-bulk-order.dto';
import { QueryMitraOrderRequestDto } from './dto/query-mitra-order-request.dto';
import { QueryTrainerWorkersDto } from './dto/query-trainer-workers.dto';

type AuthActor = {
  sub?: string;
  role?: string;
};

type WorkerCapacityStats = {
  monthlyDryInGram: number;
  currentWeekDryInGram: number;
  avgWeeklyDryInGram: number;
  weeksWithSetoran: number;
};

@Injectable()
export class MitraOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async listTrainerWorkers(query: QueryTrainerWorkersDto, actor: AuthActor) {
    const actorUser = await this.resolveActor(actor);
    const actorRole = actorUser.role.toLowerCase();

    let trainerId = query.trainerId ?? undefined;
    if (actorRole === 'trainer') {
      trainerId = actorUser.id;
    }

    const workerWhere: Prisma.WorkerWhereInput = {};
    if (trainerId && query.includeUnassigned) {
      workerWhere.OR = [{ trainerId }, { trainerId: null }];
    } else if (trainerId) {
      workerWhere.trainerId = trainerId;
    } else if (!query.includeUnassigned) {
      workerWhere.trainerId = { not: null };
    }

    const workers = await this.prisma.worker.findMany({
      where: workerWhere,
      select: {
        id: true,
        name: true,
        code: true,
        pin: true,
        capacityGram: true,
        trainerId: true,
        trainer: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
      orderBy: [{ trainerId: 'asc' }, { name: 'asc' }],
    });

    if (workers.length === 0) {
      return [];
    }

    const workerIds = workers.map((worker) => worker.id);
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
    );
    const nextMonthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
    );
    const currentWeekStart = this.startOfWeekUtc(now);

    const [activeOrders, pendingOrders, trainerOrders, receipts] = await Promise.all([
      this.prisma.workerActiveWorkOrder.findMany({
        where: { workerId: { in: workerIds } },
        select: {
          workerId: true,
          workOrderId: true,
          createdAt: true,
          workOrder: {
            select: {
              id: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      }),
      this.prisma.mitraOrderRequest.findMany({
        where: {
          workerId: { in: workerIds },
          status: {
            in: [
              MitraOrderRequestStatus.REQUESTED,
              MitraOrderRequestStatus.APPROVED,
            ],
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        select: {
          id: true,
          workerId: true,
          status: true,
          requestedGram: true,
          createdAt: true,
          requestedBy: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      }),
      this.prisma.mitraOrderRequest.findMany({
        where: {
          workerId: { in: workerIds },
          parentRequestId: { not: null },
          requestedByUserId: actorUser.id,
          status: {
            in: [
              MitraOrderRequestStatus.APPROVED,
              MitraOrderRequestStatus.FULFILLED,
            ],
          },
        },
        orderBy: [{ createdAt: 'desc' }],
        select: {
          workerId: true,
          status: true,
          createdAt: true,
          lines: {
            orderBy: { sequence: 'asc' },
            select: {
              weightGram: true,
              lpCount: true,
              workItems: {
                select: {
                  lot: {
                    select: {
                      externalId: true,
                      lotNumber: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.finishReceipt.findMany({
        where: {
          returnedAt: { gte: monthStart, lt: nextMonthStart },
          workOrderItem: {
            workOrder: {
              workerId: { in: workerIds },
            },
          },
        },
        select: {
          dryInGram: true,
          returnedAt: true,
          workOrderItem: {
            select: {
              workOrder: {
                select: {
                  workerId: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const activeByWorker = new Map(
      activeOrders.map((row) => [row.workerId, row]),
    );
    const pendingByWorker = new Map<string, typeof pendingOrders>();
    pendingOrders.forEach((order) => {
      if (!order.workerId) return;
      const list = pendingByWorker.get(order.workerId) ?? [];
      list.push(order);
      pendingByWorker.set(order.workerId, list);
    });
    const latestTrainerOrderByWorker = new Map<string, typeof trainerOrders[number]>();
    trainerOrders.forEach((order) => {
      if (order.workerId && !latestTrainerOrderByWorker.has(order.workerId)) {
        latestTrainerOrderByWorker.set(order.workerId, order);
      }
    });
    const capacityByWorker = new Map<string, WorkerCapacityStats>();
    receipts.forEach((receipt) => {
      const workerId = receipt.workOrderItem.workOrder.workerId;
      const current = capacityByWorker.get(workerId) ?? {
        monthlyDryInGram: 0,
        currentWeekDryInGram: 0,
        avgWeeklyDryInGram: 0,
        weeksWithSetoran: 0,
      };
      current.monthlyDryInGram += receipt.dryInGram;
      if (receipt.returnedAt >= currentWeekStart) {
        current.currentWeekDryInGram += receipt.dryInGram;
      }
      const weekKey = this.startOfWeekUtc(receipt.returnedAt).toISOString();
      const weeksSet =
        (current as WorkerCapacityStats & { _weeks?: Set<string> })._weeks ??
        new Set<string>();
      weeksSet.add(weekKey);
      (current as WorkerCapacityStats & { _weeks?: Set<string> })._weeks =
        weeksSet;
      capacityByWorker.set(workerId, current);
    });

    return workers.map((worker) => {
      const activeOrder = activeByWorker.get(worker.id) ?? null;
      const pending = pendingByWorker.get(worker.id) ?? [];
      const latestPending = pending[0] ?? null;
      const latestTrainerOrder = latestTrainerOrderByWorker.get(worker.id) ?? null;
      const capacity = capacityByWorker.get(worker.id);
      const weeksWithSetoran =
        (
          capacity as
            (WorkerCapacityStats & { _weeks?: Set<string> }) | undefined
        )?._weeks?.size ?? 0;
      const monthlyDryInGram = capacity?.monthlyDryInGram ?? 0;
      const currentWeekDryInGram = capacity?.currentWeekDryInGram ?? 0;
      const avgWeeklyDryInGram =
        weeksWithSetoran > 0
          ? Math.round((monthlyDryInGram / weeksWithSetoran) * 100) / 100
          : 0;

      return {
        ...worker,
        hasActiveWorkOrder: Boolean(activeOrder),
        activeWorkOrder: activeOrder
          ? {
              id: activeOrder.workOrder.id,
              status: activeOrder.workOrder.status,
              linkedAt: activeOrder.createdAt,
            }
          : null,
        pendingOrderCount: pending.length,
        pendingOrder: latestPending
          ? {
              id: latestPending.id,
              status: latestPending.status,
              requestedGram: latestPending.requestedGram,
              createdAt: latestPending.createdAt,
              requestedBy: latestPending.requestedBy,
            }
          : null,
        trainerOrder: latestTrainerOrder
          ? {
              status: latestTrainerOrder.status,
              createdAt: latestTrainerOrder.createdAt,
              orderedGram: latestTrainerOrder.lines.reduce(
                (total, line) =>
                  total + line.weightGram * (line.lpCount + line.workItems.length),
                0,
              ),
              assignedLots: latestTrainerOrder.lines.flatMap((line) =>
                line.workItems.map((workItem) => ({
                  lpNumber: workItem.lot.externalId ?? workItem.lot.lotNumber,
                })),
              ),
            }
          : null,
        isOrderEligible: (activeOrder ? 1 : 0) + pending.length < 2,
        capacityStats: {
          monthlyDryInGram,
          currentWeekDryInGram,
          avgWeeklyDryInGram,
          weeksWithSetoran,
        },
      };
    });
  }

  async create(dto: CreateMitraOrderRequestDto, actor: AuthActor) {
    const actorUser = await this.resolveActor(actor);
    const actorRole = actorUser.role.toLowerCase();
    let targetWorkerId = dto.workerId ?? null;
    const normalizedLines = (dto.lines ?? [])
      .map((line, index) => ({
        sequence: index + 1,
        weightGram: Math.round(line.weightGram),
        lpCount: Math.round(line.lpCount),
      }))
      .filter((line) => line.weightGram > 0 && line.lpCount > 0);

    if (
      dto.lines &&
      dto.lines.length > 0 &&
      normalizedLines.length !== dto.lines.length
    ) {
      return badRequest('Baris template order tidak valid');
    }

    if (actorRole === 'trainer' && normalizedLines.length === 0) {
      return unprocessable(
        'Trainer wajib mengisi rincian LP (berat x jumlah LP)',
      );
    }

    if (actorRole === 'mitra') {
      if (!actorUser.workerId) {
        return unprocessable('Akun mitra belum terhubung ke data worker');
      }
      if (dto.workerId && dto.workerId !== actorUser.workerId) {
        return conflict(
          'Mitra hanya boleh membuat order untuk dirinya sendiri',
        );
      }
      targetWorkerId = actorUser.workerId;
    }

    if (!targetWorkerId && actorRole !== 'trainer') {
      return badRequest('workerId wajib diisi');
    }

    const worker = targetWorkerId
      ? await this.prisma.worker.findUnique({
          where: { id: targetWorkerId },
          select: { id: true, name: true, trainerId: true, capacityGram: true },
        })
      : null;

    if (targetWorkerId && !worker) {
      return notFound('Worker not found', { workerId: targetWorkerId });
    }

    const requestedGram =
      normalizedLines.length > 0
        ? normalizedLines.reduce(
            (sum, line) => sum + line.weightGram * line.lpCount,
            0,
          )
        : Math.round(dto.requestedGram ?? 0);

    if (requestedGram <= 0) {
      return badRequest('Target gram order harus lebih dari 0');
    }

    if (
      actorRole === 'trainer' &&
      worker &&
      worker.trainerId &&
      worker.trainerId !== actorUser.id
    ) {
      return conflict(
        'Trainer hanya boleh membuat order untuk mitra binaannya',
        {
          workerId: worker.id,
        },
      );
    }

    if (worker) {
      const [activeOrder, pendingRequest] = await Promise.all([
        this.prisma.workerActiveWorkOrder.findUnique({
          where: { workerId: worker.id },
          select: { workOrderId: true },
        }),
        this.prisma.mitraOrderRequest.findFirst({
          where: {
            workerId: worker.id,
            status: {
              in: [
                MitraOrderRequestStatus.REQUESTED,
                MitraOrderRequestStatus.APPROVED,
              ],
            },
          },
          select: { id: true, status: true },
        }),
      ]);

      const totalActiveCount = (activeOrder ? 1 : 0) + (pendingRequest ? 1 : 0);
      if (totalActiveCount >= 2) {
        return conflict(
          'Mitra sudah mencapai batas maksimal order (1 aktif + 1 antrian)',
          {
            workerId: worker.id,
            workOrderId: activeOrder?.workOrderId,
            requestId: pendingRequest?.id,
          },
        );
      }
    }

    const request = await this.prisma.$transaction(async (tx) => {
      if (actorRole === 'trainer' && worker && !worker.trainerId) {
        await tx.worker.update({
          where: { id: worker.id },
          data: { trainerId: actorUser.id },
        });
      }

      return tx.mitraOrderRequest.create({
        data: {
          workerId: worker?.id ?? null,
          requestedByUserId: actorUser.id,
          requestedGram,
          note: dto.note?.trim() || null,
          lines: {
            create:
              normalizedLines.length > 0
                ? normalizedLines
                : [
                    {
                      sequence: 1,
                      weightGram: requestedGram,
                      lpCount: 1,
                    },
                  ],
          },
        },
        include: {
          worker: {
            select: { id: true, name: true, code: true, capacityGram: true },
          },
          requestedBy: { select: { id: true, name: true, role: true } },
          lines: { orderBy: { sequence: 'asc' } },
        },
      });
    });

    return request;
  }

  async createTrainerBulk(dto: CreateTrainerBulkOrderDto, actor: AuthActor) {
    const actorUser = await this.resolveActor(actor);
    const actorRole = actorUser.role.toLowerCase();
    if (actorRole !== 'trainer' && actorRole !== 'manager') {
      return conflict('Hanya trainer/manager yang boleh membuat order bulk', {
        role: actorUser.role,
      });
    }

    const uniqueWorkerIds = new Set(
      dto.assignments.map((entry) => entry.workerId),
    );
    if (uniqueWorkerIds.size !== dto.assignments.length) {
      return badRequest('Duplikasi worker pada assignment bulk');
    }

    const normalizedAssignments = dto.assignments.map((entry) => {
      const weightGram = Math.round(Number(entry.weightGram));
      const lpCount = Math.round(Number(entry.lpCount));
      if (!Number.isFinite(weightGram) || weightGram <= 0) {
        return badRequest('Berat per LP tidak valid', {
          workerId: entry.workerId,
          weightGram: entry.weightGram,
        });
      }
      if (!Number.isFinite(lpCount) || lpCount <= 0) {
        return badRequest('Jumlah LP tidak valid', {
          workerId: entry.workerId,
          lpCount: entry.lpCount,
        });
      }
      return {
        workerId: entry.workerId,
        weightGram,
        lpCount,
        requestedGram: weightGram * lpCount,
      };
    });

    const workerIds = Array.from(uniqueWorkerIds);
    const workers = await this.prisma.worker.findMany({
      where: { id: { in: workerIds } },
      select: {
        id: true,
        name: true,
        trainerId: true,
        capacityGram: true,
      },
    });

    if (workers.length !== workerIds.length) {
      const workerMap = new Set(workers.map((worker) => worker.id));
      const missing = workerIds.filter((id) => !workerMap.has(id));
      return notFound('Worker not found', { workerIds: missing });
    }

    if (actorRole === 'trainer') {
      const forbidden = workers.filter(
        (worker) => worker.trainerId && worker.trainerId !== actorUser.id,
      );
      if (forbidden.length > 0) {
        return conflict(
          'Trainer hanya boleh membuat order untuk mitra binaannya',
          {
            workerIds: forbidden.map((worker) => worker.id),
          },
        );
      }
    }

    const [activeOrders, pendingWorkerOrders] = await Promise.all([
      this.prisma.workerActiveWorkOrder.findMany({
        where: { workerId: { in: workerIds } },
        select: {
          workerId: true,
          workOrderId: true,
        },
      }),
      this.prisma.mitraOrderRequest.findMany({
        where: {
          workerId: { in: workerIds },
          status: {
            in: [
              MitraOrderRequestStatus.REQUESTED,
              MitraOrderRequestStatus.APPROVED,
            ],
          },
        },
        select: {
          id: true,
          workerId: true,
          status: true,
          requestedGram: true,
        },
      }),
    ]);

    const overloadedWorkers = workerIds.filter((id) => {
      const activeCount = activeOrders.filter((a) => a.workerId === id).length;
      const pendingCount = pendingWorkerOrders.filter(
        (p) => p.workerId === id,
      ).length;
      return activeCount + pendingCount >= 2;
    });

    if (overloadedWorkers.length > 0) {
      return conflict(
        'Masih ada mitra yang sudah mencapai batas maksimal order (2 order)',
        {
          workerIds: overloadedWorkers,
        },
      );
    }

    const groupedLineMap = new Map<number, number>();
    let totalRequestedGram = 0;
    let totalLp = 0;
    normalizedAssignments.forEach((assignment) => {
      groupedLineMap.set(
        assignment.weightGram,
        (groupedLineMap.get(assignment.weightGram) ?? 0) + assignment.lpCount,
      );
      totalRequestedGram += assignment.requestedGram;
      totalLp += assignment.lpCount;
    });

    const groupedLines = Array.from(groupedLineMap.entries())
      .sort((left, right) => right[0] - left[0])
      .map(([weightGram, lpCount], index) => ({
        sequence: index + 1,
        weightGram,
        lpCount,
      }));

    const createIndividualRequests = dto.createIndividualRequests !== false;
    const groupedCreatedAt = new Date();
    const result = await this.prisma.$transaction(async (tx) => {
      if (actorRole === 'trainer') {
        await tx.worker.updateMany({
          where: { id: { in: workerIds }, trainerId: null },
          data: { trainerId: actorUser.id },
        });
      }

      const aggregateRequest = await tx.mitraOrderRequest.create({
        data: {
          workerId: null,
          requestedByUserId: actorUser.id,
          requestedGram: totalRequestedGram,
          note: dto.note?.trim() || null,
          createdAt: groupedCreatedAt,
          lines: {
            create: groupedLines,
          },
        },
        include: {
          worker: {
            select: { id: true, name: true, code: true, capacityGram: true },
          },
          requestedBy: { select: { id: true, name: true, role: true } },
          processedBy: { select: { id: true, name: true, role: true } },
          lines: { orderBy: { sequence: 'asc' } },
        },
      });

      const workerRequests: (typeof aggregateRequest)[] = [];

      if (createIndividualRequests) {
        for (const assignment of normalizedAssignments) {
          const workerRequest = await tx.mitraOrderRequest.create({
            data: {
              workerId: assignment.workerId,
              parentRequestId: aggregateRequest.id,
              requestedByUserId: actorUser.id,
              requestedGram: assignment.requestedGram,
              note: dto.note?.trim() || null,
              createdAt: groupedCreatedAt,
              lines: {
                create: [
                  {
                    sequence: 1,
                    weightGram: assignment.weightGram,
                    lpCount: assignment.lpCount,
                  },
                ],
              },
            },
            include: {
              worker: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  capacityGram: true,
                },
              },
              requestedBy: { select: { id: true, name: true, role: true } },
              processedBy: { select: { id: true, name: true, role: true } },
              lines: { orderBy: { sequence: 'asc' } },
            },
          });
          workerRequests.push(workerRequest);
        }
      }

      return {
        aggregateRequest,
        workerRequests,
      };
    });

    return {
      ...result,
      summary: {
        workerCount: normalizedAssignments.length,
        totalRequestedGram,
        totalLp,
      },
    };
  }

  async findAll(query: QueryMitraOrderRequestDto, actor: AuthActor) {
    const actorUser = await this.resolveActor(actor);
    const actorRole = actorUser.role.toLowerCase();
    const where: Prisma.MitraOrderRequestWhereInput = {};

    if (actorRole === 'mitra') {
      if (!actorUser.workerId) {
        return unprocessable('Akun mitra belum terhubung ke data worker');
      }
      where.workerId = actorUser.workerId;
    } else if (actorRole === 'trainer') {
      where.OR = [
        { requestedByUserId: actorUser.id },
        { worker: { trainerId: actorUser.id } },
      ];
    } else if (query.workerId) {
      where.workerId = query.workerId;
    }

    if (query.workerId && actorRole === 'trainer') {
      where.workerId = query.workerId;
    }

    if (query.parentRequestId) {
      where.parentRequestId = query.parentRequestId;
    } else if (actorRole !== 'mitra') {
      where.parentRequestId = null;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.requestedByRole) {
      where.requestedBy = {
        role: query.requestedByRole,
      };
    }

    if (query.aggregateOnly) {
      where.workerId = null;
    }

    const limit = query.limit ?? 50;
    const items = await this.prisma.mitraOrderRequest.findMany({
      where,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
            code: true,
            capacityGram: true,
            trainerId: true,
            productionRoomId: true,
            trainer: { select: { productionRoomId: true } },
          },
        },
        requestedBy: { select: { id: true, name: true, role: true } },
        processedBy: { select: { id: true, name: true, role: true } },
        lines: { orderBy: { sequence: 'asc' } },
      },
    });

    return items.sort((left, right) => {
      const leftPriority = left.requestedBy.role === 'TRAINER' ? 0 : 1;
      const rightPriority = right.requestedBy.role === 'TRAINER' ? 0 : 1;
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      return (
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      );
    });
  }

  async findById(id: string, actor: AuthActor) {
    const actorUser = await this.resolveActor(actor);
    const actorRole = actorUser.role.toLowerCase();

    const request = await this.prisma.mitraOrderRequest.findUnique({
      where: { id },
      include: {
        worker: {
          select: {
            id: true,
            name: true,
            code: true,
            capacityGram: true,
            trainerId: true,
          },
        },
        requestedBy: { select: { id: true, name: true, role: true } },
        processedBy: { select: { id: true, name: true, role: true } },
        lines: { orderBy: { sequence: 'asc' } },
      },
    });

    if (!request) {
      return notFound('Order request not found', { requestId: id });
    }

    if (actorRole === 'mitra' && actorUser.workerId !== request.workerId) {
      return conflict('Akses order mitra ditolak', { requestId: id });
    }

    if (
      actorRole === 'trainer' &&
      request.requestedBy.id !== actorUser.id &&
      request.worker?.trainerId !== actorUser.id
    ) {
      return conflict('Akses order mitra ditolak', { requestId: id });
    }

    return request;
  }

  async approve(id: string, actor: AuthActor) {
    const actorUser = await this.resolveActor(actor);
    const request = await this.prisma.mitraOrderRequest.findUnique({
      where: { id },
      include: {
        requestedBy: { select: { id: true } },
        worker: { select: { id: true, trainerId: true } },
      },
    });

    if (!request) {
      return notFound('Order request not found', { requestId: id });
    }
    if (request.status !== MitraOrderRequestStatus.REQUESTED) {
      return conflict('Order request sudah diproses', {
        requestId: id,
        status: request.status,
      });
    }

    const actorRole = actorUser.role.toLowerCase();
    if (
      actorRole === 'trainer' &&
      request.requestedBy.id !== actorUser.id &&
      request.worker?.trainerId !== actorUser.id
    ) {
      return conflict('Trainer hanya boleh memproses order mitra binaannya', {
        requestId: id,
      });
    }
    const processedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.mitraOrderRequest.update({
        where: { id },
        data: {
          status: MitraOrderRequestStatus.APPROVED,
          processedByUserId: actorUser.id,
          processedAt,
        },
        include: {
          worker: {
            select: { id: true, name: true, code: true, capacityGram: true },
          },
          requestedBy: { select: { id: true, name: true, role: true } },
          processedBy: { select: { id: true, name: true, role: true } },
          lines: { orderBy: { sequence: 'asc' } },
        },
      });

      if (!request.workerId) {
        await tx.mitraOrderRequest.updateMany({
          where: {
            workerId: { not: null },
            requestedByUserId: request.requestedByUserId,
            status: MitraOrderRequestStatus.REQUESTED,
            createdAt: request.createdAt,
          },
          data: {
            status: MitraOrderRequestStatus.APPROVED,
            processedByUserId: actorUser.id,
            processedAt,
          },
        });
      }

      return updated;
    });
  }

  async reject(id: string, reason: string, actor: AuthActor) {
    const actorUser = await this.resolveActor(actor);
    const request = await this.prisma.mitraOrderRequest.findUnique({
      where: { id },
      include: {
        requestedBy: { select: { id: true } },
        worker: { select: { id: true, trainerId: true } },
      },
    });

    if (!request) {
      return notFound('Order request not found', { requestId: id });
    }
    if (request.status !== MitraOrderRequestStatus.REQUESTED) {
      return conflict('Order request sudah diproses', {
        requestId: id,
        status: request.status,
      });
    }

    const actorRole = actorUser.role.toLowerCase();
    if (
      actorRole === 'trainer' &&
      request.requestedBy.id !== actorUser.id &&
      request.worker?.trainerId !== actorUser.id
    ) {
      return conflict('Trainer hanya boleh memproses order mitra binaannya', {
        requestId: id,
      });
    }

    const processedAt = new Date();
    const rejectionReason = reason.trim() || 'Ditolak';
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.mitraOrderRequest.update({
        where: { id },
        data: {
          status: MitraOrderRequestStatus.REJECTED,
          rejectionReason,
          processedByUserId: actorUser.id,
          processedAt,
        },
        include: {
          worker: {
            select: { id: true, name: true, code: true, capacityGram: true },
          },
          requestedBy: { select: { id: true, name: true, role: true } },
          processedBy: { select: { id: true, name: true, role: true } },
          lines: { orderBy: { sequence: 'asc' } },
        },
      });

      if (!request.workerId) {
        await tx.mitraOrderRequest.updateMany({
          where: {
            workerId: { not: null },
            requestedByUserId: request.requestedByUserId,
            status: MitraOrderRequestStatus.REQUESTED,
            createdAt: request.createdAt,
          },
          data: {
            status: MitraOrderRequestStatus.REJECTED,
            rejectionReason,
            processedByUserId: actorUser.id,
            processedAt,
          },
        });
      }

      return updated;
    });
  }

  async assignWorker(id: string, workerId: string, actor: AuthActor) {
    const actorUser = await this.resolveActor(actor);
    const actorRole = actorUser.role.toLowerCase();
    const request = await this.prisma.mitraOrderRequest.findUnique({
      where: { id },
      include: {
        requestedBy: { select: { id: true } },
      },
    });

    if (!request) {
      return notFound('Order request not found', { requestId: id });
    }

    if (request.status !== MitraOrderRequestStatus.REQUESTED) {
      return conflict('Order request sudah diproses', {
        requestId: id,
        status: request.status,
      });
    }

    if (actorRole === 'trainer' && request.requestedBy.id !== actorUser.id) {
      return conflict('Trainer hanya boleh assign order miliknya sendiri', {
        requestId: id,
      });
    }

    const worker = await this.prisma.worker.findUnique({
      where: { id: workerId },
      select: { id: true, trainerId: true },
    });

    if (!worker) {
      return notFound('Worker not found', { workerId });
    }

    if (
      actorRole === 'trainer' &&
      worker.trainerId &&
      worker.trainerId !== actorUser.id
    ) {
      return conflict('Trainer hanya boleh assign ke mitra binaannya', {
        workerId,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      if (actorRole === 'trainer' && !worker.trainerId) {
        await tx.worker.update({
          where: { id: worker.id },
          data: { trainerId: actorUser.id },
        });
      }

      return tx.mitraOrderRequest.update({
        where: { id },
        data: {
          workerId: worker.id,
        },
        include: {
          worker: {
            select: { id: true, name: true, code: true, capacityGram: true },
          },
          requestedBy: { select: { id: true, name: true, role: true } },
          processedBy: { select: { id: true, name: true, role: true } },
          lines: { orderBy: { sequence: 'asc' } },
        },
      });
    });
  }

  async markFulfilled(id: string, actor: AuthActor) {
    await this.resolveActor(actor);
    const request = await this.prisma.mitraOrderRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return notFound('Order request not found', { requestId: id });
    }
    if (request.status !== MitraOrderRequestStatus.APPROVED) {
      return conflict('Order request belum disetujui', {
        requestId: id,
        status: request.status,
      });
    }

    return conflict(
      'Order harus dipenuhi melalui Pecah Bon agar setiap LP terikat ke mitra yang benar',
      { requestId: id },
    );
  }

  async cancel(id: string, actor: AuthActor) {
    const actorUser = await this.resolveActor(actor);
    const request = await this.prisma.mitraOrderRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return notFound('Order request not found', { requestId: id });
    }

    if (request.status !== MitraOrderRequestStatus.REQUESTED) {
      return conflict('Hanya order berstatus REQUESTED yang dapat dibatalkan', {
        requestId: id,
        status: request.status,
      });
    }

    // Check ownership if actor is mitra
    if (actorUser.role === 'MITRA' && request.workerId !== actorUser.workerId) {
      return conflict('Anda hanya dapat membatalkan order milik Anda sendiri');
    }

    await this.prisma.mitraOrderRequest.delete({
      where: { id },
    });

    return { success: true };
  }

  async updateRequest(
    id: string,
    dto: { requestedGram: number; lpCount?: number; note?: string },
    actor: AuthActor,
  ) {
    const actorUser = await this.resolveActor(actor);
    const request = await this.prisma.mitraOrderRequest.findUnique({
      where: { id },
      include: { lines: true },
    });

    if (!request) {
      return notFound('Order request not found', { requestId: id });
    }

    if (request.status !== MitraOrderRequestStatus.REQUESTED) {
      return conflict('Hanya order berstatus REQUESTED yang dapat diubah', {
        requestId: id,
        status: request.status,
      });
    }

    // Check ownership if actor is mitra
    if (actorUser.role === 'MITRA' && request.workerId !== actorUser.workerId) {
      return conflict('Anda hanya dapat mengubah order milik Anda sendiri');
    }

    const inputWeight = Math.round(dto.requestedGram);
    const lpCount = Math.round(dto.lpCount ?? request.lines[0]?.lpCount ?? 1);
    if (inputWeight <= 0) {
      return badRequest('Target gram per LP harus lebih dari 0');
    }
    if (lpCount <= 0) {
      return badRequest('Jumlah LP harus lebih dari 0');
    }

    const totalRequestedGram = inputWeight * lpCount;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.mitraOrderRequest.update({
        where: { id },
        data: {
          requestedGram: totalRequestedGram,
          note: dto.note !== undefined ? dto.note?.trim() || null : undefined,
        },
        include: {
          worker: {
            select: { id: true, name: true, code: true, capacityGram: true },
          },
          requestedBy: { select: { id: true, name: true, role: true } },
          lines: { orderBy: { sequence: 'asc' } },
        },
      });

      if (updated.lines.length === 1) {
        await tx.mitraOrderRequestLine.update({
          where: { id: updated.lines[0].id },
          data: {
            weightGram: inputWeight,
            lpCount: lpCount,
          },
        });
      } else if (updated.lines.length === 0) {
        await tx.mitraOrderRequestLine.create({
          data: {
            orderRequestId: id,
            sequence: 1,
            weightGram: inputWeight,
            lpCount: lpCount,
          },
        });
      } else {
        await tx.mitraOrderRequestLine.update({
          where: { id: updated.lines[0].id },
          data: {
            weightGram: inputWeight,
            lpCount: lpCount,
          },
        });
      }

      return tx.mitraOrderRequest.findUnique({
        where: { id },
        include: {
          worker: {
            select: { id: true, name: true, code: true, capacityGram: true },
          },
          requestedBy: { select: { id: true, name: true, role: true } },
          lines: { orderBy: { sequence: 'asc' } },
        },
      });
    });
  }

  private async resolveActor(actor: AuthActor) {
    const actorId = actor.sub;
    if (!actorId) {
      return unprocessable('User not found');
    }

    const actorUser = await this.prisma.appUser.findUnique({
      where: { id: actorId },
      select: { id: true, role: true, workerId: true },
    });

    if (!actorUser) {
      return unprocessable('User not found');
    }

    return actorUser;
  }

  private startOfWeekUtc(date: Date) {
    const value = new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const day = (value.getUTCDay() + 6) % 7;
    value.setUTCDate(value.getUTCDate() - day);
    return value;
  }
}
