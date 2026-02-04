import { GradeType } from "@prisma/client";
export declare class UpdateGradeDto {
    name?: string;
    code?: string;
    type?: GradeType;
}
