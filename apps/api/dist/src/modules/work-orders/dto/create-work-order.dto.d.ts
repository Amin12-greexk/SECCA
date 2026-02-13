import { WorkLane } from "@prisma/client";
export declare class CreateWorkOrderDto {
    workerId: string;
    lotNumbers: string[];
    lane?: WorkLane;
}
