import { RackType } from "@prisma/client";
export declare class CreateLocationDto {
    createDefaults?: boolean;
    code?: string;
    name?: string;
    type?: RackType;
    workerId?: string;
}
