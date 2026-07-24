import { HttpException, HttpStatus } from '@nestjs/common';

import { type DomainError, DomainErrorKind } from '@/shared/domain/domain-error';
import { match, type Result } from '@/shared/domain/result';

const STATUS_BY_KIND: Record<DomainErrorKind, HttpStatus> = {
  [DomainErrorKind.Validation]: HttpStatus.BAD_REQUEST,
  [DomainErrorKind.NotFound]: HttpStatus.NOT_FOUND,
  [DomainErrorKind.Conflict]: HttpStatus.CONFLICT,
  [DomainErrorKind.Unavailable]: HttpStatus.BAD_GATEWAY,
  [DomainErrorKind.Unexpected]: HttpStatus.INTERNAL_SERVER_ERROR,
};

export const httpStatusFor = (error: DomainError): HttpStatus =>
  STATUS_BY_KIND[error.kind] ?? HttpStatus.INTERNAL_SERVER_ERROR;

export const toHttpException = (error: DomainError): HttpException =>
  new HttpException(
    {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
    httpStatusFor(error),
  );

export const unwrapOrThrow = <T>(result: Result<T, DomainError>): T =>
  match(result, {
    onOk: (value) => value,
    onErr: (error) => {
      throw toHttpException(error);
    },
  });
