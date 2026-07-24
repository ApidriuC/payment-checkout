export enum DomainErrorKind {
  Validation = 'VALIDATION',
  NotFound = 'NOT_FOUND',
  Conflict = 'CONFLICT',
  Unavailable = 'UNAVAILABLE',
  Unexpected = 'UNEXPECTED',
}

export abstract class DomainError {
  abstract readonly code: string;

  abstract readonly kind: DomainErrorKind;

  protected constructor(
    readonly message: string,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {}
}

export class UnexpectedError extends DomainError {
  readonly code = 'UNEXPECTED_ERROR';
  readonly kind = DomainErrorKind.Unexpected;

  constructor(message: string, readonly cause?: unknown) {
    super(message);
  }
}
