import { Injectable } from "@nestjs/common";
import { MitraOrderRequestStatus, Prisma } from "@prisma/client";
import { badRequest, conflict, notFound, unprocessable } from "../../common/errors";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateMitraOrderRequestDto } from "./dto/create-mitra-order-request.dto";
import { QueryMitraOrderRequestDto } from "./dto/query-mitra-order-request.dto";

type AuthActor = {
  sub?: string;
  role?: string;
};

@Injectable()
export class MitraOrdersService {
  constructor(private readonly prisma: PrismaService) {}

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

    if (dto.lines && dto.lines.length > 0 && normalizedLines.length !== dto.lines.length) {
      return badRequest("Baris template order tidak valid");
    }

    if (actorRole === "trainer" && normalizedLines.length === 0) {
      return unprocessable("Trainer wajib mengisi rincian LP (berat x jumlah LP)");
    }

    if (actorRole === "mitra") {
      if (!actorUser.workerId) {
        return unprocessable("Akun mitra belum terhubung ke data worker");
      }
      if (dto.workerId && dto.workerId !== actorUser.workerId) {
        return conflict("Mitra hanya boleh membuat order untuk dirinya sendiri");
      }
      targetWorkerId = actorUser.workerId;
    }

    if (!targetWorkerId && actorRole !== "trainer") {
      return badRequest("workerId wajib diisi");
    }

    const worker = targetWorkerId
      ? await this.prisma.worker.findUnique({
          where: { id: targetWorkerId },
          select: { id: true, name: true, trainerId: true, capacityGram: true },
        })
      : null;

    if (targetWorkerId && !worker) {
      return notFound("Worker not found", { workerId: targetWorkerId });
    }

    const requestedGram =
      normalizedLines.length > 0
        ? normalizedLines.reduce(
            (sum, line) => sum + line.weightGram * line.lpCount,
            0,
          )
        : Math.round(dto.requestedGram ?? 0);

    if (requestedGram <= 0) {
      return badRequest("Target gram order harus lebih dari 0");
    }

    if (actorRole === "trainer" && worker && worker.trainerId !== actorUser.id) {
      return conflict("Trainer hanya boleh membuat order untuk mitra binaannya", {
        workerId: worker.id,
      });
    }

    if (worker && worker.capacityGram != null && requestedGram > worker.capacityGram) {
      return conflict("Melebihi kapasitas worker", {
        capacityGram: worker.capacityGram,
        requestedGram,
      });
    }

    const request = await this.prisma.mitraOrderRequest.create({
      data: {
        workerId: worker?.id ?? null,
        requestedByUserId: actorUser.id,
        requestedGram,
        note: dto.note?.trim() || null,
        lines:
          normalizedLines.length > 0
            ? {
                create: normalizedLines,
              }
            : undefined,
      },
      include: {
        worker: { select: { id: true, name: true, code: true, capacityGram: true } },
        requestedBy: { select: { id: true, name: true, role: true } },
        lines: { orderBy: { sequence: "asc" } },
      },
    });

    return request;
  }

  async findAll(query: QueryMitraOrderRequestDto, actor: AuthActor) {
    const actorUser = await this.resolveActor(actor);
    const actorRole = actorUser.role.toLowerCase();
    const where: Prisma.MitraOrderRequestWhereInput = {};

    if (actorRole === "mitra") {
      if (!actorUser.workerId) {
        return unprocessable("Akun mitra belum terhubung ke data worker");
      }
      where.workerId = actorUser.workerId;
    } else if (actorRole === "trainer") {
      where.OR = [
        { requestedByUserId: actorUser.id },
        { worker: { trainerId: actorUser.id } },
      ];
    } else if (query.workerId) {
      where.workerId = query.workerId;
    }

    if (query.workerId && actorRole === "trainer") {
      where.workerId = query.workerId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.requestedByRole) {
      where.requestedBy = {
        role: query.requestedByRole,
      };
    }

    const limit = query.limit ?? 50;
    const items = await this.prisma.mitraOrderRequest.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        worker: { select: { id: true, name: true, code: true, capacityGram: true } },
        requestedBy: { select: { id: true, name: true, role: true } },
        processedBy: { select: { id: true, name: true, role: true } },
        lines: { orderBy: { sequence: "asc" } },
      },
    });

    return items.sort((left, right) => {
      const leftPriority = left.requestedBy.role === "TRAINER" ? 0 : 1;
      const rightPriority = right.requestedBy.role === "TRAINER" ? 0 : 1;
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
        worker: { select: { id: true, name: true, code: true, capacityGram: true, trainerId: true } },
        requestedBy: { select: { id: true, name: true, role: true } },
        processedBy: { select: { id: true, name: true, role: true } },
        lines: { orderBy: { sequence: "asc" } },
      },
    });

    if (!request) {
      return notFound("Order request not found", { requestId: id });
    }

    if (actorRole === "mitra" && actorUser.workerId !== request.workerId) {
      return conflict("Akses order mitra ditolak", { requestId: id });
    }

    if (
      actorRole === "trainer" &&
      request.requestedBy.id !== actorUser.id &&
      request.worker?.trainerId !== actorUser.id
    ) {
      return conflict("Akses order mitra ditolak", { requestId: id });
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
      return notFound("Order request not found", { requestId: id });
    }
    if (request.status !== MitraOrderRequestStatus.REQUESTED) {
      return conflict("Order request sudah diproses", {
        requestId: id,
        status: request.status,
      });
    }

    if (!request.workerId) {
      return badRequest("Order belum di-assign ke mitra");
    }

    const actorRole = actorUser.role.toLowerCase();
    if (
      actorRole === "trainer" &&
      request.requestedBy.id !== actorUser.id &&
      request.worker?.trainerId !== actorUser.id
    ) {
      return conflict("Trainer hanya boleh memproses order mitra binaannya", {
        requestId: id,
      });
    }

    return this.prisma.mitraOrderRequest.update({
      where: { id },
      data: {
        status: MitraOrderRequestStatus.APPROVED,
        processedByUserId: actorUser.id,
        processedAt: new Date(),
      },
      include: {
        worker: { select: { id: true, name: true, code: true, capacityGram: true } },
        requestedBy: { select: { id: true, name: true, role: true } },
        processedBy: { select: { id: true, name: true, role: true } },
        lines: { orderBy: { sequence: "asc" } },
      },
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
      return notFound("Order request not found", { requestId: id });
    }
    if (request.status !== MitraOrderRequestStatus.REQUESTED) {
      return conflict("Order request sudah diproses", {
        requestId: id,
        status: request.status,
      });
    }

    const actorRole = actorUser.role.toLowerCase();
    if (
      actorRole === "trainer" &&
      request.requestedBy.id !== actorUser.id &&
      request.worker?.trainerId !== actorUser.id
    ) {
      return conflict("Trainer hanya boleh memproses order mitra binaannya", {
        requestId: id,
      });
    }

    return this.prisma.mitraOrderRequest.update({
      where: { id },
      data: {
        status: MitraOrderRequestStatus.REJECTED,
        rejectionReason: reason.trim() || "Ditolak",
        processedByUserId: actorUser.id,
        processedAt: new Date(),
      },
      include: {
        worker: { select: { id: true, name: true, code: true, capacityGram: true } },
        requestedBy: { select: { id: true, name: true, role: true } },
        processedBy: { select: { id: true, name: true, role: true } },
        lines: { orderBy: { sequence: "asc" } },
      },
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
      return notFound("Order request not found", { requestId: id });
    }

    if (request.status !== MitraOrderRequestStatus.REQUESTED) {
      return conflict("Order request sudah diproses", {
        requestId: id,
        status: request.status,
      });
    }

    if (actorRole === "trainer" && request.requestedBy.id !== actorUser.id) {
      return conflict("Trainer hanya boleh assign order miliknya sendiri", {
        requestId: id,
      });
    }

    const worker = await this.prisma.worker.findUnique({
      where: { id: workerId },
      select: { id: true, trainerId: true, capacityGram: true },
    });

    if (!worker) {
      return notFound("Worker not found", { workerId });
    }

    if (actorRole === "trainer" && worker.trainerId !== actorUser.id) {
      return conflict("Trainer hanya boleh assign ke mitra binaannya", {
        workerId,
      });
    }

    if (worker.capacityGram != null && request.requestedGram > worker.capacityGram) {
      return conflict("Melebihi kapasitas worker", {
        capacityGram: worker.capacityGram,
        requestedGram: request.requestedGram,
      });
    }

    return this.prisma.mitraOrderRequest.update({
      where: { id },
      data: {
        workerId: worker.id,
      },
      include: {
        worker: { select: { id: true, name: true, code: true, capacityGram: true } },
        requestedBy: { select: { id: true, name: true, role: true } },
        processedBy: { select: { id: true, name: true, role: true } },
        lines: { orderBy: { sequence: "asc" } },
      },
    });
  }

  async markFulfilled(id: string, actor: AuthActor) {
    const actorUser = await this.resolveActor(actor);
    const request = await this.prisma.mitraOrderRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return notFound("Order request not found", { requestId: id });
    }
    if (request.status !== MitraOrderRequestStatus.APPROVED) {
      return conflict("Order request belum disetujui", {
        requestId: id,
        status: request.status,
      });
    }

    if (!request.workerId) {
      return badRequest("Order belum di-assign ke mitra");
    }

    return this.prisma.mitraOrderRequest.update({
      where: { id },
      data: {
        status: MitraOrderRequestStatus.FULFILLED,
        processedByUserId: actorUser.id,
        processedAt: new Date(),
      },
      include: {
        worker: { select: { id: true, name: true, code: true, capacityGram: true } },
        requestedBy: { select: { id: true, name: true, role: true } },
        processedBy: { select: { id: true, name: true, role: true } },
        lines: { orderBy: { sequence: "asc" } },
      },
    });
  }

  private async resolveActor(actor: AuthActor) {
    const actorId = actor.sub;
    if (!actorId) {
      return unprocessable("User not found");
    }

    const actorUser = await this.prisma.appUser.findUnique({
      where: { id: actorId },
      select: { id: true, role: true, workerId: true },
    });

    if (!actorUser) {
      return unprocessable("User not found");
    }

    return actorUser;
  }
}
