import { FinishService } from "./finish.service";
import { FinishDto } from "./dto/finish.dto";
export declare class FinishController {
    private readonly finishService;
    constructor(finishService: FinishService);
    finish(dto: FinishDto): Promise<{
        lotNumber: string;
        dryInGram: number;
        mainOutGram: number;
        byProductGram: number;
        susutProsesGram: number;
        susutHilangGram: number;
        susutProsesPctBps: number;
        susutHilangPctBps: number;
        payroll: {
            rateRpPerGram: number;
            amountRp: number;
        };
    }>;
}
