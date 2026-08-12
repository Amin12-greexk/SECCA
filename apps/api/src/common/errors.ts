import { HttpException, HttpStatus } from '@nestjs/common';

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE'
  | 'INTERNAL_ERROR';

export const throwHttpError = (
  status: HttpStatus,
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): never => {
  throw new HttpException(
    {
      error: code,
      message,
      details,
    },
    status,
  );
};

export const badRequest = (
  message: string,
  details?: Record<string, unknown>,
) => throwHttpError(HttpStatus.BAD_REQUEST, 'BAD_REQUEST', message, details);

export const notFound = (message: string, details?: Record<string, unknown>) =>
  throwHttpError(HttpStatus.NOT_FOUND, 'NOT_FOUND', message, details);

export const conflict = (message: string, details?: Record<string, unknown>) =>
  throwHttpError(HttpStatus.CONFLICT, 'CONFLICT', message, details);

export const unprocessable = (
  message: string,
  details?: Record<string, unknown>,
) =>
  throwHttpError(
    HttpStatus.UNPROCESSABLE_ENTITY,
    'UNPROCESSABLE',
    message,
    details,
  );
