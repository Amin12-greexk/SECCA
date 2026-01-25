import { PrismaService } from "../../prisma/prisma.service";
import { NumberingService } from "../../common/numbering/numbering.service";
import { ReceiveRawBatchDto } from "./dto/receive-raw-batch.dto";
export declare class BakuService {
    private readonly prisma;
    private readonly numberingService;
    constructor(prisma: PrismaService, numberingService: NumberingService);
    receive(dto: ReceiveRawBatchDto): Promise<{
        rawBatchId: string;
        cardNumber: string;
        qrPayload: string;
    }>;
}
