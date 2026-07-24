export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E> = Ok<T> | Err<E>;

export type AsyncResult<T, E> = Promise<Result<T, E>>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const okVoid = (): Ok<void> => ok(undefined);

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.ok;

export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => !result.ok;

export const map = <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
  result.ok ? ok(fn(result.value)) : result;

export const mapErr = <T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> =>
  result.ok ? result : err(fn(result.error));

export const andThen = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> => (result.ok ? fn(result.value) : result);

export const andThenAsync = async <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => AsyncResult<U, E>,
): AsyncResult<U, E> => (result.ok ? fn(result.value) : result);

export const tap = <T, E>(result: Result<T, E>, fn: (value: T) => void): Result<T, E> => {
  if (result.ok) {
    fn(result.value);
  }
  return result;
};

export const match = <T, E, U>(
  result: Result<T, E>,
  handlers: { onOk: (value: T) => U; onErr: (error: E) => U },
): U => (result.ok ? handlers.onOk(result.value) : handlers.onErr(result.error));

export const unwrapOr = <T, E>(result: Result<T, E>, fallback: T): T =>
  result.ok ? result.value : fallback;

export const combine = <T, E>(results: ReadonlyArray<Result<T, E>>): Result<T[], E> => {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) {
      return result;
    }
    values.push(result.value);
  }
  return ok(values);
};

export const fromPromise = async <T, E>(
  promise: Promise<T>,
  onThrow: (cause: unknown) => E,
): AsyncResult<T, E> => {
  try {
    return ok(await promise);
  } catch (cause) {
    return err(onThrow(cause));
  }
};
