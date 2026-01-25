import { PrismaService } from "../../prisma/prisma.service";
import { CreateSupplierDto } from "./dto/create-supplier.dto";
export declare class SuppliersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    create(dto: CreateSupplierDto): import("@prisma/client").Prisma.Prisma__SupplierClient<{
        id: string;
        code: string | null;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        phone: string | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findAll(): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        code: string | null;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        phone: string | null;
    }[]>;
}
