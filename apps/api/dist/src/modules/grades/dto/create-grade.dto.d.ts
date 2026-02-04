import { GradeType } from "@prisma/client";
export declare class CreateGradeDto {
    name: string;
    code: string;
    type: GradeType;
}
