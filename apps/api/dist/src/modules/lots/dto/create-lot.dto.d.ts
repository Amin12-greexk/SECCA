import { LotSourceDto } from "./lot-source.dto";
export declare class CreateLotDto {
    gradeId: string;
    sources: LotSourceDto[];
    moistureBps?: number;
}
