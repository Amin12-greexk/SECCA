import { ReceiveRawBatchDto } from "./dto/receive-raw-batch.dto";
import { BakuService } from "./baku.service";
export declare class BakuController {
    private readonly bakuService;
    constructor(bakuService: BakuService);
    receive(dto: ReceiveRawBatchDto): Promise<{
        rawBatchId: string;
        cardNumber: string;
        qrPayload: string;
    }>;
}
