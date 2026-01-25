import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateWorkerDto } from "./dto/create-worker.dto";

@Injectable()
export class WorkersService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateWorkerDto) {
    return this.prisma.worker.create({
      data: {
        name: dto.name,
        code: dto.code,
      },
    });
  }

  findAll() {
    return this.prisma.worker.findMany({
      orderBy: { createdAt: "asc" },
    });
  }
}
