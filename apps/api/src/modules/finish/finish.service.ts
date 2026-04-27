import { Injectable } from "@nestjs/common";
import {
  LotStatus,
  MovementType,
  Prisma,
  RackType,
  WorkLane,
  WorkOrderItemStatus,
  WorkOrderStatus,
} from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { InventoryMovementService } from "../../common/inventory/inventory-movement.service";
import { badRequest, conflict, notFound, unprocessable } from "../../common/errors";
import { LOCATION_CODES, workerRackCode } from "../../common/constants";
import {
  calcRendemenMainBps,
  calcRendemenNetBps,
  calcSusutHilang,
  calcSusutProses,
  toBps,
} from "../../common/utils/weight";
import { FinishDto } from "./dto/finish.dto";
import { QueryFinishReceiptsDto } from "./dto/query-finish-receipts.dto";
import { UpdateFinishReceiptDto } from "./dto/update-finish-receipt.dto";

@Injectable()
export class FinishService {
  private static readonly DRYING_HOURS = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly movementService: InventoryMovementService,
  ) {}

  private deriveFlowState(input: {
    status: WorkOrderItemStatus;
    lane: WorkLane;
    readyAt: Date | null;
    dryingStartedAt: Date | null;
    dryingReadyAt: Date | null;
    dryCheckedAt: Date | null;
  }) {
    const {
      status,
      lane,
      readyAt,
      dryingStartedAt,
      dryingReadyAt,
      dryCheckedAt,
    } = input;

    if (status === WorkOrderItemStatus.COMPLETED) return "SUBMITTED";
    if (status === WorkOrderItemStatus.CANCELED) return "CANCELED";
    if (lane === WorkLane.NEXT_DAY) return "NEXT_DAY";
    if (lane === WorkLane.READY_TO_SUBMIT) return "READY_TO_SUBMIT";
    if (dryCheckedAt) return "READY_TO_SUBMIT";
    if (dryingStartedAt || readyAt) {
      if (dryingReadyAt && dryingReadyAt.getTime() <= Date.now()) {
        return "DRYING_QC";
      }
      return "DRYING";
    }
    return "IN_PROGRESS";
  }

  private calcMetrics(dryIn: number, mainOut: number, byProduct: number) {
    const susutProsesGram = calcSusutProses(byProduct);
    const susutHilangGram = calcSusutHilang(dryIn, mainOut, byProduct);
    const susutProsesPctBps = toBps(susutProsesGram, dryIn);
    const susutHilangPctBps = toBps(susutHilangGram, dryIn);
    const rendemenMainPctBps = calcRendemenMainBps(dryIn, mainOut);
    const rendemenNetPctBps = calcRendemenNetBps(dryIn, mainOut, byProduct);

    return {
      susutProsesGram,
      susutHilangGram,
      susutProsesPctBps,
      susutHilangPctBps,
      rendemenMainPctBps,
      rendemenNetPctBps,
    };
  }

  private calcPayroll(rateRpPerGram: number, mainOut: number, byProduct: number) {
    const byProductCoefficientBps = this.getByProductCoefficientBps();
    const payrollWeightedGramBps = mainOut * 10000 + byProduct * byProductCoefficientBps;
    const payrollBaseGram = Number((payrollWeightedGramBps / 10000).toFixed(2));
    const amountRp = Math.round((rateRpPerGram * payrollWeightedGramBps) / 10000);

    return {
      byProductCoefficientBps,
      payrollWeightedGramBps,
      payrollBaseGram,
      amountRp,
    };
  }

  private normalizeResultGrades(
    resultGrades:
      | Array<{
          resultGradeTypeId: string;
          weightGram: number;
        }>
      | undefined,
  ) {
    if (!resultGrades) {
      return [];
    }

    const byType = new Map<string, number>();
    for (const item of resultGrades) {
      const resultGradeTypeId = item.resultGradeTypeId?.trim();
      const weightGram = Math.max(0, Math.round(item.weightGram ?? 0));
      if (!resultGradeTypeId || weightGram <= 0) {
        continue;
      }

      byType.set(resultGradeTypeId, (byType.get(resultGradeTypeId) ?? 0) + weightGram);
    }

    return Array.from(byType.entries())
      .map(([resultGradeTypeId, weightGram]) => ({ resultGradeTypeId, weightGram }))
      .sort((left, right) =>
        left.resultGradeTypeId.localeCompare(right.resultGradeTypeId),
      );
  }

  private async ensureBarangJadiExists(
    tx: Prisma.TransactionClient,
    barangJadiId: string | null | undefined,
  ) {
    if (!barangJadiId) return null;

    const barangJadi = await tx.barangJadi.findUnique({
      where: { id: barangJadiId },
      include: {
        resultGrades: {
          select: {
            resultGradeTypeId: true,
          },
        },
      },
    });

    if (!barangJadi) {
      return notFound("Barang jadi tidak ditemukan", { barangJadiId });
    }

    return barangJadi;
  }

  private async resolveResultGradeBreakdown(
    tx: Prisma.TransactionClient,
    barangJadi:
      | {
          id: string;
          resultGrades: Array<{
            resultGradeTypeId: string;
          }>;
        }
      | null,
    resultGrades:
      | Array<{
          resultGradeTypeId: string;
          weightGram: number;
        }>
      | undefined,
  ) {
    const normalized = this.normalizeResultGrades(resultGrades);

    if (normalized.length === 0) {
      return {
        items: [] as Array<{
          resultGradeTypeId: string;
          name: string;
          weightGram: number;
        }>,
        totalWeightGram: 0,
      };
    }

    const typeIds = normalized.map((item) => item.resultGradeTypeId);
    const resultGradeTypes = await tx.barangJadiGradeType.findMany({
      where: {
        id: { in: typeIds },
      },
      orderBy: { name: "asc" },
    });

    if (resultGradeTypes.length !== typeIds.length) {
      return notFound("Ada grade hasil yang tidak ditemukan", {
        requested: typeIds.length,
        found: resultGradeTypes.length,
      });
    }

    if (barangJadi) {
      const allowedIds = new Set(
        barangJadi.resultGrades.map((item) => item.resultGradeTypeId),
      );
      const invalidIds = typeIds.filter((item) => !allowedIds.has(item));
      if (invalidIds.length > 0) {
        return badRequest("Grade hasil tidak sesuai dengan barang jadi terpilih", {
          barangJadiId: barangJadi.id,
          invalidResultGradeTypeIds: invalidIds,
        });
      }
    }

    const byId = new Map(resultGradeTypes.map((item) => [item.id, item]));
    return {
      items: normalized.map((item) => ({
        resultGradeTypeId: item.resultGradeTypeId,
        name: byId.get(item.resultGradeTypeId)?.name ?? item.resultGradeTypeId,
        weightGram: item.weightGram,
      })),
      totalWeightGram: normalized.reduce((sum, item) => sum + item.weightGram, 0),
    };
  }

  private async resolveRateRpPerGram(
    tx: Prisma.TransactionClient,
    lot: {
      gradeId: string;
      featherGradeId: string | null;
      colorGradeId: string | null;
    },
    at: Date,
  ) {
    const baseTariff = await tx.gradeTariff.findFirst({
      where: {
        shapeGradeId: lot.gradeId,
        featherGradeId: null,
        colorGradeId: null,
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      orderBy: { effectiveFrom: "desc" },
    });

    if (!baseTariff) {
      return unprocessable("Tarif bentuk belum dikonfigurasi", {
        shapeGradeId: lot.gradeId,
        at: at.toISOString(),
      });
    }

    let featherRate = 0;
    if (lot.featherGradeId) {
      const featherTariff = await tx.gradeTariff.findFirst({
        where: {
          shapeGradeId: lot.gradeId,
          featherGradeId: lot.featherGradeId,
          colorGradeId: null,
          effectiveFrom: { lte: at },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
        },
        orderBy: { effectiveFrom: "desc" },
      });
      featherRate = featherTariff?.rateRpPerGram ?? 0;
    }

    let colorRate = 0;
    if (lot.featherGradeId && lot.colorGradeId) {
      const colorTariff = await tx.gradeTariff.findFirst({
        where: {
          shapeGradeId: lot.gradeId,
          featherGradeId: lot.featherGradeId,
          colorGradeId: lot.colorGradeId,
          effectiveFrom: { lte: at },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
        },
        orderBy: { effectiveFrom: "desc" },
      });
      colorRate = colorTariff?.rateRpPerGram ?? 0;
    }

    return baseTariff.rateRpPerGram + featherRate + colorRate;
  }

  async findWorkItemByLpCode(lpCode: string) {
    const normalizedCode = lpCode.trim().toUpperCase();
    if (!normalizedCode) {
      return badRequest("Nomor LP wajib diisi");
    }

    const lot = await this.prisma.productionLot.findFirst({
      where: {
        OR: [
          { externalId: normalizedCode },
          { lotNumber: normalizedCode },
        ],
      },
      include: {
        grade: true,
        featherGrade: true,
        colorGrade: true,
        location: true,
        workItem: {
          include: {
            finishReceipt: true,
            workOrder: {
              include: {
                worker: true,
              },
            },
          },
        },
      },
    });

    if (!lot) {
      return notFound("LP tidak ditemukan", { lpCode: normalizedCode });
    }

    const workItem = lot.workItem;
    if (!workItem) {
      return conflict("LP belum di-assign ke work order", {
        lpCode: normalizedCode,
        lotId: lot.id,
      });
    }

    const dryingStartedAt = workItem.dryingStartedAt ?? workItem.readyAt;
    const dryingReadyAt =
      workItem.dryingReadyAt ??
      (dryingStartedAt
        ? new Date(
            dryingStartedAt.getTime() +
              FinishService.DRYING_HOURS * 60 * 60 * 1000,
          )
        : null);
    const flowState = this.deriveFlowState({
      status: workItem.status,
      lane: workItem.lane,
      readyAt: workItem.readyAt,
      dryingStartedAt,
      dryingReadyAt,
      dryCheckedAt: workItem.dryCheckedAt,
    });
    const dryingRemainingMinutes =
      dryingReadyAt && Date.now() < dryingReadyAt.getTime()
        ? Math.ceil((dryingReadyAt.getTime() - Date.now()) / (60 * 1000))
        : 0;

    return {
      workOrderItemId: workItem.id,
      workOrderId: workItem.workOrderId,
      workOrderStatus: workItem.workOrder.status,
      workOrderItemStatus: workItem.status,
      lane: workItem.lane,
      noLp: lot.externalId ?? lot.lotNumber,
      lotNumber: lot.lotNumber,
      pecahBonId: lot.externalId,
      workerId: workItem.workOrder.workerId,
      workerName: workItem.workOrder.worker.name,
      grade: `${lot.grade.code}/${lot.featherGrade?.code ?? "-"}/${lot.colorGrade?.code ?? "-"}`,
      dryInGram: lot.dryWeightGramLocked,
      wetWeightGram: lot.wetWeightGram,
      moisturePercent: Number((lot.moistureBps / 100).toFixed(2)),
      submittedAt: workItem.finishReceipt?.returnedAt ?? null,
      flowState,
      dryingStartedAt,
      dryingReadyAt,
      dryCheckedAt: workItem.dryCheckedAt ?? null,
      dryingRemainingMinutes,
      canSubmit:
        workItem.status === WorkOrderItemStatus.IN_PROGRESS &&
        workItem.lane === WorkLane.READY_TO_SUBMIT &&
        (!dryingReadyAt || Date.now() >= dryingReadyAt.getTime()) &&
        (!!workItem.dryCheckedAt || !workItem.dryingStartedAt),
    };
  }

  async listReceipts(query: QueryFinishReceiptsDto) {
    const limit = query.limit ?? 20;
    const requestedPage = query.page ?? 1;
    const page = Math.max(1, requestedPage);
    const search = query.search?.trim();
    const order = query.order ?? "desc";

    const where: Prisma.FinishReceiptWhereInput = {};

    if (query.from || query.to) {
      const returnedAt: Prisma.DateTimeFilter = {};
      if (query.from) {
        returnedAt.gte = new Date(`${query.from}T00:00:00.000`);
      }
      if (query.to) {
        returnedAt.lte = new Date(`${query.to}T23:59:59.999`);
      }
      where.returnedAt = returnedAt;
    }

    if (search) {
      where.OR = [
        {
          workOrderItem: {
            lot: {
              OR: [
                { externalId: { contains: search, mode: "insensitive" } },
                { lotNumber: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
        {
          workOrderItem: {
            workOrder: {
              worker: {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { code: { contains: search, mode: "insensitive" } },
                ],
              },
            },
          },
        },
        {
          workOrderItem: {
            lot: {
              OR: [
                { grade: { code: { contains: search, mode: "insensitive" } } },
                { featherGrade: { code: { contains: search, mode: "insensitive" } } },
                { colorGrade: { code: { contains: search, mode: "insensitive" } } },
              ],
            },
          },
        },
      ];
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.finishReceipt.count({ where }),
      this.prisma.finishReceipt.findMany({
        where,
        orderBy: [{ returnedAt: order }, { createdAt: order }],
        skip: (page - 1) * limit,
        take: limit,
        include: {
          barangJadi: true,
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
          workOrderItem: {
            include: {
              payrollEntry: true,
              lot: {
                include: {
                  grade: true,
                  featherGrade: true,
                  colorGrade: true,
                },
              },
              workOrder: {
                include: {
                  worker: true,
                },
              },
            },
          },
        },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      items: rows.map((row) => ({
        id: row.id,
        workOrderItemId: row.workOrderItemId,
        returnedAt: row.returnedAt,
        noLp: row.workOrderItem.lot.externalId ?? row.workOrderItem.lot.lotNumber,
        lotNumber: row.workOrderItem.lot.lotNumber,
        workerId: row.workOrderItem.workOrder.workerId,
        workerName: row.workOrderItem.workOrder.worker.name,
        grade: `${row.workOrderItem.lot.grade.code}/${row.workOrderItem.lot.featherGrade?.code ?? "-"}/${row.workOrderItem.lot.colorGrade?.code ?? "-"}`,
        barangJadi: row.barangJadi
          ? {
              id: row.barangJadi.id,
              name: row.barangJadi.name,
            }
          : null,
        resultGrades: row.resultGrades.map((item) => ({
          id: item.resultGradeType.id,
          name: item.resultGradeType.name,
          weightGram: item.weightGram,
        })),
        dryInGram: row.dryInGram,
        mainOutWeightGram: row.mainOutWeightGram,
        byProductWeightGram: row.byProductWeightGram,
        susutProsesGram: row.susutProsesGram,
        susutHilangGram: row.susutHilangGram,
        susutProsesPctBps: row.susutProsesPctBps,
        susutHilangPctBps: row.susutHilangPctBps,
        notes: row.notes,
        payroll: row.workOrderItem.payrollEntry
          ? {
              id: row.workOrderItem.payrollEntry.id,
              rateRpPerGram: row.workOrderItem.payrollEntry.rateRpPerGram,
              amountRp: row.workOrderItem.payrollEntry.amountRp,
            }
          : null,
      })),
      page,
      limit,
      total,
      totalPages,
    };
  }

  async updateReceipt(receiptId: string, dto: UpdateFinishReceiptDto) {
    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.finishReceipt.findUnique({
        where: { id: receiptId },
        include: {
          barangJadi: true,
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
          workOrderItem: {
            include: {
              lot: {
                include: {
                  grade: true,
                  featherGrade: true,
                  colorGrade: true,
                },
              },
              workOrder: {
                include: {
                  worker: true,
                },
              },
              payrollEntry: true,
            },
          },
        },
      });

      if (!receipt) {
        return notFound("Finish receipt not found", { receiptId });
      }

      const barangJadi = await this.ensureBarangJadiExists(
        tx,
        dto.barangJadiId === undefined ? receipt.barangJadiId : dto.barangJadiId,
      );

      if (
        dto.returnedAt === undefined &&
        dto.barangJadiId === undefined &&
        dto.mainOutWeightGram === undefined &&
        dto.byProductWeightGram === undefined &&
        dto.notes === undefined &&
        dto.resultGrades === undefined
      ) {
        return badRequest("Tidak ada perubahan data");
      }

      const returnedAt = dto.returnedAt ? new Date(dto.returnedAt) : receipt.returnedAt;
      const dryIn = receipt.dryInGram;
      const effectiveResultGrades =
        dto.resultGrades === undefined
          ? receipt.resultGrades.map((item) => ({
              resultGradeTypeId: item.resultGradeTypeId,
              weightGram: item.weightGram,
            }))
          : dto.resultGrades;
      const resultGradeBreakdown = await this.resolveResultGradeBreakdown(
        tx,
        barangJadi,
        effectiveResultGrades,
      );
      if (resultGradeBreakdown.items.length > 0 && !barangJadi) {
        return badRequest("Pilih barang jadi sebelum mengisi grade hasil", {
          receiptId,
        });
      }
      if (
        barangJadi &&
        barangJadi.resultGrades.length > 0 &&
        dto.resultGrades !== undefined &&
        resultGradeBreakdown.items.length === 0
      ) {
        return badRequest("Isi grade hasil barang jadi terlebih dahulu", {
          barangJadiId: barangJadi.id,
        });
      }
      const mainOut =
        resultGradeBreakdown.items.length > 0
          ? resultGradeBreakdown.totalWeightGram
          : Math.round(dto.mainOutWeightGram ?? receipt.mainOutWeightGram);
      const byProduct = Math.round(dto.byProductWeightGram ?? receipt.byProductWeightGram);

      if (mainOut + byProduct > dryIn) {
        return badRequest("Output weight exceeds dry input", {
          dryInGram: dryIn,
          mainOutGram: mainOut,
          byProductGram: byProduct,
        });
      }

      const rateRpPerGram = await this.resolveRateRpPerGram(
        tx,
        {
          gradeId: receipt.workOrderItem.lot.gradeId,
          featherGradeId: receipt.workOrderItem.lot.featherGradeId,
          colorGradeId: receipt.workOrderItem.lot.colorGradeId,
        },
        returnedAt,
      );

      const metrics = this.calcMetrics(dryIn, mainOut, byProduct);
      const payroll = this.calcPayroll(rateRpPerGram, mainOut, byProduct);

      const updatedReceipt = await tx.finishReceipt.update({
        where: { id: receipt.id },
        data: {
          returnedAt,
          barangJadiId: dto.barangJadiId === undefined ? receipt.barangJadiId : dto.barangJadiId ?? null,
          mainOutWeightGram: mainOut,
          byProductWeightGram: byProduct,
          susutProsesGram: metrics.susutProsesGram,
          susutHilangGram: metrics.susutHilangGram,
          susutProsesPctBps: metrics.susutProsesPctBps,
          susutHilangPctBps: metrics.susutHilangPctBps,
          notes: dto.notes === undefined ? receipt.notes : dto.notes || null,
          resultGrades:
            dto.resultGrades === undefined
              ? undefined
              : {
                  deleteMany: {},
                  create: resultGradeBreakdown.items.map((item) => ({
                    resultGradeTypeId: item.resultGradeTypeId,
                    weightGram: item.weightGram,
                  })),
                },
        },
        include: {
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
      });

      await tx.payrollEntry.upsert({
        where: { workOrderItemId: receipt.workOrderItemId },
        update: {
          workerId: receipt.workOrderItem.workOrder.workerId,
          gradeId: receipt.workOrderItem.lot.gradeId,
          rateRpPerGram,
          amountRp: payroll.amountRp,
        },
        create: {
          workOrderItemId: receipt.workOrderItemId,
          workerId: receipt.workOrderItem.workOrder.workerId,
          gradeId: receipt.workOrderItem.lot.gradeId,
          rateRpPerGram,
          amountRp: payroll.amountRp,
        },
      });

      return {
        id: updatedReceipt.id,
        workOrderItemId: updatedReceipt.workOrderItemId,
        returnedAt: updatedReceipt.returnedAt,
        barangJadi: barangJadi
          ? {
              id: barangJadi.id,
              name: barangJadi.name,
            }
          : null,
        resultGrades: updatedReceipt.resultGrades.map((item) => ({
          id: item.resultGradeType.id,
          name: item.resultGradeType.name,
          weightGram: item.weightGram,
        })),
        mainOutWeightGram: updatedReceipt.mainOutWeightGram,
        byProductWeightGram: updatedReceipt.byProductWeightGram,
        dryInGram: updatedReceipt.dryInGram,
        susutProsesGram: updatedReceipt.susutProsesGram,
        susutHilangGram: updatedReceipt.susutHilangGram,
        susutProsesPctBps: updatedReceipt.susutProsesPctBps,
        susutHilangPctBps: updatedReceipt.susutHilangPctBps,
        rendemenMainPctBps: metrics.rendemenMainPctBps,
        rendemenNetPctBps: metrics.rendemenNetPctBps,
        notes: updatedReceipt.notes,
        payroll: {
          baseGram: payroll.payrollBaseGram,
          byProductCoefficientPercent: Number(
            (payroll.byProductCoefficientBps / 100).toFixed(2),
          ),
          rateRpPerGram,
          amountRp: payroll.amountRp,
        },
      };
    });
  }

  async removeReceipt(receiptId: string) {
    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.finishReceipt.findUnique({
        where: { id: receiptId },
        include: {
          workOrderItem: {
            include: {
              lot: {
                include: {
                  location: true,
                },
              },
              workOrder: {
                include: {
                  worker: true,
                },
              },
            },
          },
        },
      });

      if (!receipt) {
        return notFound("Finish receipt not found", { receiptId });
      }

      const workerId = receipt.workOrderItem.workOrder.workerId;
      const active = await tx.workerActiveWorkOrder.findUnique({
        where: { workerId },
      });
      if (active && active.workOrderId !== receipt.workOrderItem.workOrderId) {
        return conflict(
          "Tidak bisa rollback setoran karena worker sudah punya order aktif lain",
          {
            workerId,
            activeWorkOrderId: active.workOrderId,
            targetWorkOrderId: receipt.workOrderItem.workOrderId,
          },
        );
      }

      const workerLocation = await tx.rackLocation.upsert({
        where: { workerId },
        update: {
          code: workerRackCode(workerId),
          name: `Rak Mitra - ${receipt.workOrderItem.workOrder.worker.name}`,
          type: RackType.WORKER,
        },
        create: {
          workerId,
          code: workerRackCode(workerId),
          name: `Rak Mitra - ${receipt.workOrderItem.workOrder.worker.name}`,
          type: RackType.WORKER,
        },
      });

      await tx.payrollEntry.deleteMany({
        where: { workOrderItemId: receipt.workOrderItemId },
      });

      await tx.finishReceipt.delete({
        where: { id: receiptId },
      });

      await tx.workOrderItem.update({
        where: { id: receipt.workOrderItemId },
        data: {
          status: WorkOrderItemStatus.IN_PROGRESS,
          lane: WorkLane.READY_TO_SUBMIT,
        },
      });

      await tx.productionLot.update({
        where: { id: receipt.workOrderItem.lotId },
        data: {
          status: LotStatus.IN_PROGRESS,
          locationId: workerLocation.id,
        },
      });

      if (receipt.workOrderItem.lot.locationId !== workerLocation.id) {
        await this.movementService.record(tx, {
          lotId: receipt.workOrderItem.lotId,
          fromLocationId: receipt.workOrderItem.lot.locationId,
          toLocationId: workerLocation.id,
          movementType: MovementType.MOVE,
          note: "Rollback finish receipt",
        });
      }

      await tx.workOrder.update({
        where: { id: receipt.workOrderItem.workOrderId },
        data: {
          status: WorkOrderStatus.IN_PROGRESS,
          completedAt: null,
        },
      });

      await tx.workerActiveWorkOrder.upsert({
        where: { workerId },
        update: { workOrderId: receipt.workOrderItem.workOrderId },
        create: {
          workerId,
          workOrderId: receipt.workOrderItem.workOrderId,
        },
      });

      return {
        id: receipt.id,
        workOrderItemId: receipt.workOrderItemId,
        restoredToLane: WorkLane.READY_TO_SUBMIT,
        restoredLocationCode: workerLocation.code,
      };
    });
  }

  async finish(dto: FinishDto) {
    return this.prisma.$transaction(async (tx) => {
      const workItem = await tx.workOrderItem.findUnique({
        where: { id: dto.workOrderItemId },
        include: {
          lot: { include: { grade: true, featherGrade: true, colorGrade: true, location: true } },
          workOrder: { include: { worker: true } },
        },
      });

      if (!workItem) {
        return notFound("Work order item not found", {
          workOrderItemId: dto.workOrderItemId,
        });
      }

      if (workItem.status === WorkOrderItemStatus.COMPLETED) {
        return conflict("Work order item already finished", {
          workOrderItemId: workItem.id,
        });
      }

      if (workItem.status === WorkOrderItemStatus.CANCELED) {
        return conflict("Work order item sudah dibatalkan", {
          workOrderItemId: workItem.id,
        });
      }

      if (workItem.lane !== WorkLane.READY_TO_SUBMIT) {
        return conflict("LP belum siap setor (lane belum READY_TO_SUBMIT)", {
          workOrderItemId: workItem.id,
          lane: workItem.lane,
        });
      }

      const returnedAt = new Date(dto.returnedAt);
      if (workItem.dryingReadyAt && returnedAt.getTime() < workItem.dryingReadyAt.getTime()) {
        const remainingMinutes = Math.ceil(
          (workItem.dryingReadyAt.getTime() - returnedAt.getTime()) / (60 * 1000),
        );
        return conflict("Waktu pengeringan belum mencapai batas minimal", {
          workOrderItemId: workItem.id,
          dryingReadyAt: workItem.dryingReadyAt,
          remainingMinutes,
        });
      }

      if (workItem.dryingStartedAt && !workItem.dryCheckedAt) {
        return conflict("Koreksi kering belum diselesaikan", {
          workOrderItemId: workItem.id,
        });
      }

      const barangJadi = await this.ensureBarangJadiExists(tx, dto.barangJadiId);
      const resultGradeBreakdown = await this.resolveResultGradeBreakdown(
        tx,
        barangJadi,
        dto.resultGrades,
      );
      if (resultGradeBreakdown.items.length > 0 && !barangJadi) {
        return badRequest("Pilih barang jadi sebelum mengisi grade hasil", {
          workOrderItemId: workItem.id,
        });
      }
      if (barangJadi && barangJadi.resultGrades.length > 0 && resultGradeBreakdown.items.length === 0) {
        return badRequest("Isi grade hasil barang jadi terlebih dahulu", {
          barangJadiId: barangJadi.id,
        });
      }

      const mainOut =
        resultGradeBreakdown.items.length > 0
          ? resultGradeBreakdown.totalWeightGram
          : dto.mainOutWeightGram;
      const byProduct = dto.byProductWeightGram ?? 0;
      const dryIn = workItem.lot.dryWeightGramLocked;

      if (mainOut + byProduct > dryIn) {
        return badRequest("Output weight exceeds dry input", {
          dryInGram: dryIn,
          mainOutGram: mainOut,
          byProductGram: byProduct,
        });
      }

      const susutProsesGram = calcSusutProses(byProduct);
      const susutHilangGram = calcSusutHilang(dryIn, mainOut, byProduct);
      const susutProsesPctBps = toBps(susutProsesGram, dryIn);
      const susutHilangPctBps = toBps(susutHilangGram, dryIn);
      const rendemenMainPctBps = calcRendemenMainBps(dryIn, mainOut);
      const rendemenNetPctBps = calcRendemenNetBps(dryIn, mainOut, byProduct);

      const baseTariff = await tx.gradeTariff.findFirst({
        where: {
          shapeGradeId: workItem.lot.gradeId,
          featherGradeId: null,
          colorGradeId: null,
          effectiveFrom: { lte: returnedAt },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: returnedAt } }],
        },
        orderBy: { effectiveFrom: "desc" },
      });

      if (!baseTariff) {
        return unprocessable("Tarif bentuk belum dikonfigurasi", {
          shapeGradeId: workItem.lot.gradeId,
          at: returnedAt.toISOString(),
        });
      }

      let featherRate = 0;
      if (workItem.lot.featherGradeId) {
        const featherTariff = await tx.gradeTariff.findFirst({
          where: {
            shapeGradeId: workItem.lot.gradeId,
            featherGradeId: workItem.lot.featherGradeId,
            colorGradeId: null,
            effectiveFrom: { lte: returnedAt },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: returnedAt } }],
          },
          orderBy: { effectiveFrom: "desc" },
        });
        featherRate = featherTariff?.rateRpPerGram ?? 0;
      }

      let colorRate = 0;
      if (workItem.lot.featherGradeId && workItem.lot.colorGradeId) {
        const colorTariff = await tx.gradeTariff.findFirst({
          where: {
            shapeGradeId: workItem.lot.gradeId,
            featherGradeId: workItem.lot.featherGradeId,
            colorGradeId: workItem.lot.colorGradeId,
            effectiveFrom: { lte: returnedAt },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: returnedAt } }],
          },
          orderBy: { effectiveFrom: "desc" },
        });
        colorRate = colorTariff?.rateRpPerGram ?? 0;
      }

      const rateRpPerGram = baseTariff.rateRpPerGram + featherRate + colorRate;
      const byProductCoefficientBps = this.getByProductCoefficientBps();
      // Payroll = main out + by-product berbobot koefisien (default 50%).
      const payrollWeightedGramBps = mainOut * 10000 + byProduct * byProductCoefficientBps;
      const payrollBaseGram = Number((payrollWeightedGramBps / 10000).toFixed(2));
      const amountRp = Math.round((rateRpPerGram * payrollWeightedGramBps) / 10000);
      const finishedLocation = await tx.rackLocation.upsert({
        where: { code: LOCATION_CODES.FINISHED },
        update: { name: "Rak Finished", type: RackType.FINISHED },
        create: {
          code: LOCATION_CODES.FINISHED,
          name: "Rak Finished",
          type: RackType.FINISHED,
        },
      });

      await tx.finishReceipt.create({
        data: {
          workOrderItemId: workItem.id,
          barangJadiId: dto.barangJadiId ?? null,
          returnedAt,
          mainOutWeightGram: mainOut,
          byProductWeightGram: byProduct,
          dryInGram: dryIn,
          susutProsesGram,
          susutHilangGram,
          susutProsesPctBps,
          susutHilangPctBps,
          notes: dto.notes,
          resultGrades: {
            create: resultGradeBreakdown.items.map((item) => ({
              resultGradeTypeId: item.resultGradeTypeId,
              weightGram: item.weightGram,
            })),
          },
        },
      });

      await tx.payrollEntry.create({
        data: {
          workOrderItemId: workItem.id,
          workerId: workItem.workOrder.workerId,
          gradeId: workItem.lot.gradeId,
          rateRpPerGram,
          amountRp,
        },
      });

      await tx.productionLot.update({
        where: { id: workItem.lotId },
        data: {
          status: LotStatus.COMPLETED,
          locationId: finishedLocation.id,
        },
      });

      await tx.workOrderItem.update({
        where: { id: workItem.id },
        data: { status: WorkOrderItemStatus.COMPLETED },
      });

      await this.movementService.record(tx, {
        lotId: workItem.lotId,
        fromLocationId: workItem.lot.locationId,
        toLocationId: finishedLocation.id,
        movementType: MovementType.MOVE,
        note: "Finish work order",
      });

      const remaining = await tx.workOrderItem.count({
        where: {
          workOrderId: workItem.workOrderId,
          status: WorkOrderItemStatus.IN_PROGRESS,
        },
      });

      if (remaining === 0) {
        await tx.workOrder.update({
          where: { id: workItem.workOrderId },
          data: { status: WorkOrderStatus.COMPLETED, completedAt: new Date() },
        });

        await tx.workerActiveWorkOrder.deleteMany({
          where: { workOrderId: workItem.workOrderId },
        });
      }

      return {
        lotNumber: workItem.lot.lotNumber,
        barangJadi: barangJadi
          ? {
              id: barangJadi.id,
              name: barangJadi.name,
            }
          : null,
        resultGrades: resultGradeBreakdown.items.map((item) => ({
          id: item.resultGradeTypeId,
          name: item.name,
          weightGram: item.weightGram,
        })),
        dryInGram: dryIn,
        mainOutGram: mainOut,
        byProductGram: byProduct,
        susutProsesGram,
        susutHilangGram,
        susutProsesPctBps,
        susutHilangPctBps,
        rendemenMainPctBps,
        rendemenNetPctBps,
        payroll: {
          baseGram: payrollBaseGram,
          byProductCoefficientPercent: Number((byProductCoefficientBps / 100).toFixed(2)),
          rateRpPerGram,
          amountRp,
        },
      };
    });
  }

  private getByProductCoefficientBps() {
    const raw = Number(process.env.PAYROLL_BYPRODUCT_COEFFICIENT_BPS ?? 5000);
    if (!Number.isFinite(raw)) return 5000;
    return Math.max(0, Math.min(10000, Math.round(raw)));
  }
}
