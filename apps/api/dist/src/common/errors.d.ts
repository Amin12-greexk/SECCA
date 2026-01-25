import { HttpStatus } from "@nestjs/common";
export type ErrorCode = "BAD_REQUEST" | "NOT_FOUND" | "CONFLICT" | "UNPROCESSABLE" | "INTERNAL_ERROR";
export declare const throwHttpError: (status: HttpStatus, code: ErrorCode, message: string, details?: Record<string, unknown>) => never;
export declare const badRequest: (message: string, details?: Record<string, unknown>) => never;
export declare const notFound: (message: string, details?: Record<string, unknown>) => never;
export declare const conflict: (message: string, details?: Record<string, unknown>) => never;
export declare const unprocessable: (message: string, details?: Record<string, unknown>) => never;
