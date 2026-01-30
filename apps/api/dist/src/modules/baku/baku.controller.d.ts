import { ReceiveRawBatchDto } from "./dto/receive-raw-batch.dto";
import { BakuService } from "./baku.service";
export declare class BakuController {
    private readonly bakuService;
    constructor(bakuService: BakuService);
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
