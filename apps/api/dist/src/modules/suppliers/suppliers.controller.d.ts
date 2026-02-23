import { CreateSupplierDto } from "./dto/create-supplier.dto";
import { UpdateSupplierDto } from "./dto/update-supplier.dto";
import { SuppliersService } from "./suppliers.service";
export declare class SuppliersController {
    private readonly suppliersService;
    constructor(suppliersService: SuppliersService);
    create(dto: CreateSupplierDto): import("@prisma/client").Prisma.Prisma__SupplierClient<{
        id: string;
        phone: string | null;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findAll(): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        phone: string | null;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
    }[]>;
    update(supplierId: string, dto: UpdateSupplierDto): Promise<{
        id: string;
        phone: string | null;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
    }>;
    remove(supplierId: string): Promise<{
        id: string;
        phone: string | null;
        name: string;
        createdAt: Date;
        updatedAt: Date;
        code: string | null;
    }>;
}
