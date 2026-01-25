import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.payrollEntry.findMany({
      include: { worker: true, grade: true, workOrderItem: true },
      orderBy: { createdAt: "desc" },
    });
  }
}
