import { PrismaService } from "../../prisma/prisma.service";
import { NumberingService } from "../../common/numbering/numbering.service";
import { ReceiveRawBatchDto } from "./dto/receive-raw-batch.dto";
export declare class BakuService {
    private readonly prisma;
    private readonly numberingService;
    private readonly logger;
    constructor(prisma: PrismaService, numberingService: NumberingService);
    receive(dto: ReceiveRawBatchDto): Promise<{
        rawBatchId: string;
        cardNumber: string;
        qrPayload: string;
        supplier: {
            id: string;
            name: string;
            code: string | null;
        };
        wetWeightGram: number;
        receivedAt: Date;
    }>;
    findAll(): Promise<{
        rawBatchId: string;
        cardNumber: string;
        supplier: {
            id: string;
            name: string;
            code: string | null;
        };
        wetWeightGram: number;
        receivedAt: Date;
        notes: string | null;
    }[]>;
    findByCardNumber(cardNumber: string): Promise<{
        rawBatchId: string;
        cardNumber: string;
        supplier: {
            id: string;
            name: string;
            code: string | null;
        };
        wetWeightGram: number;
        receivedAt: Date;
        notes: string | null;
    }>;
}
