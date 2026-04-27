import { FinishResultGradeEntryDto } from "./finish-result-grade-entry.dto";
export declare class FinishDto {
    workOrderItemId: string;
    returnedAt: string;
    mainOutWeightGram: number;
    barangJadiId?: string;
    byProductWeightGram?: number;
    notes?: string;
    resultGrades?: FinishResultGradeEntryDto[];
}
