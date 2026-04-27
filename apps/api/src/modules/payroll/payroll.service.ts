import { Injectable } from "@nestjs/common";
import { badRequest } from "../../common/errors";
import { toBps } from "../../common/utils/weight";
import { PrismaService } from "../../prisma/prisma.service";
import { PayrollSummaryQueryDto } from "./dto/payroll-summary-query.dto";

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.payrollEntry.findMany({
      include: {
        worker: true,
        grade: true,
        workOrderItem: {
          include: {
            finishReceipt: true,
            lot: {
              include: {
                grade: true,
                featherGrade: true,
                colorGrade: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getSummary(query: PayrollSummaryQueryDto) {
    const { from, to } = this.getDateRange(query.from, query.to);

    const receipts = await this.prisma.finishReceipt.findMany({
      where: {
        returnedAt: { gte: from, lte: to },
        workOrderItem: query.workerId
          ? { workOrder: { workerId: query.workerId } }
          : undefined,
      },
      include: {
        workOrderItem: {
          include: {
            workOrder: {
              include: {
                worker: true,
              },
            },
            payrollEntry: true,
          },
        },
      },
      orderBy: { returnedAt: "asc" },
    });

    const totals = receipts.reduce(
      (acc, item) => {
        acc.items += 1;
        acc.dryInGram += item.dryInGram;
        acc.mainOutWeightGram += item.mainOutWeightGram;
        acc.byProductWeightGram += item.byProductWeightGram;
        acc.susutProsesGram += item.susutProsesGram;
        acc.susutHilangGram += item.susutHilangGram;
        acc.payrollAmountRp += item.workOrderItem.payrollEntry?.amountRp ?? 0;
        return acc;
      },
      {
        items: 0,
        dryInGram: 0,
        mainOutWeightGram: 0,
        byProductWeightGram: 0,
        susutProsesGram: 0,
        susutHilangGram: 0,
        payrollAmountRp: 0,
      },
    );

    const workerSummaryMap = new Map<
      string,
      {
        workerId: string;
        workerName: string;
        items: number;
        dryInGram: number;
        mainOutWeightGram: number;
        byProductWeightGram: number;
        susutProsesGram: number;
        susutHilangGram: number;
        payrollAmountRp: number;
      }
    >();

    for (const item of receipts) {
      const worker = item.workOrderItem.workOrder.worker;
      const existing = workerSummaryMap.get(worker.id) ?? {
        workerId: worker.id,
        workerName: worker.name,
        items: 0,
        dryInGram: 0,
        mainOutWeightGram: 0,
        byProductWeightGram: 0,
        susutProsesGram: 0,
        susutHilangGram: 0,
        payrollAmountRp: 0,
      };

      existing.items += 1;
      existing.dryInGram += item.dryInGram;
      existing.mainOutWeightGram += item.mainOutWeightGram;
      existing.byProductWeightGram += item.byProductWeightGram;
      existing.susutProsesGram += item.susutProsesGram;
      existing.susutHilangGram += item.susutHilangGram;
      existing.payrollAmountRp += item.workOrderItem.payrollEntry?.amountRp ?? 0;
      workerSummaryMap.set(worker.id, existing);
    }

    const workerSummary = Array.from(workerSummaryMap.values()).map((row) => ({
      ...row,
      rendemenMainPctBps: toBps(row.mainOutWeightGram, row.dryInGram),
      rendemenNetPctBps: toBps(
        row.mainOutWeightGram + row.byProductWeightGram,
        row.dryInGram,
      ),
      susutProsesPctBps: toBps(row.susutProsesGram, row.dryInGram),
      susutHilangPctBps: toBps(row.susutHilangGram, row.dryInGram),
    }));

    return {
      filters: {
        from: from.toISOString(),
        to: to.toISOString(),
        workerId: query.workerId ?? null,
      },
      summary: {
        ...totals,
        rendemenMainPctBps: toBps(totals.mainOutWeightGram, totals.dryInGram),
        rendemenNetPctBps: toBps(
          totals.mainOutWeightGram + totals.byProductWeightGram,
          totals.dryInGram,
        ),
        susutProsesPctBps: toBps(totals.susutProsesGram, totals.dryInGram),
        susutHilangPctBps: toBps(totals.susutHilangGram, totals.dryInGram),
      },
      workers: workerSummary.sort((a, b) => b.payrollAmountRp - a.payrollAmountRp),
    };
  }

  private getDateRange(from?: string, to?: string) {
    const now = new Date();
    const fallbackFrom = new Date(now);
    fallbackFrom.setDate(fallbackFrom.getDate() - 30);
    fallbackFrom.setHours(0, 0, 0, 0);

    const start = from ? new Date(from) : fallbackFrom;
    const end = to ? new Date(to) : now;

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return badRequest("Format tanggal tidak valid", { from, to });
    }

    if (start.getTime() > end.getTime()) {
      return badRequest("Rentang tanggal tidak valid: from harus <= to", {
        from,
        to,
      });
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { from: start, to: end };
  }
}
