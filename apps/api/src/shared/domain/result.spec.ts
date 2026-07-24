import {
  andThen,
  andThenAsync,
  combine,
  err,
  fromPromise,
  isErr,
  isOk,
  map,
  mapErr,
  match,
  ok,
  okVoid,
  tap,
  unwrapOr,
} from './result';

describe('Result', () => {
  describe('constructors', () => {
    it('builds a success track carrying the value', () => {
      expect(ok(42)).toEqual({ ok: true, value: 42 });
    });

    it('builds a failure track carrying the error', () => {
      expect(err('boom')).toEqual({ ok: false, error: 'boom' });
    });

    it('builds a success track with no value', () => {
      expect(okVoid()).toEqual({ ok: true, value: undefined });
    });
  });

  describe('guards', () => {
    it('narrows a success', () => {
      expect(isOk(ok(1))).toBe(true);
      expect(isErr(ok(1))).toBe(false);
    });

    it('narrows a failure', () => {
      expect(isErr(err('x'))).toBe(true);
      expect(isOk(err('x'))).toBe(false);
    });
  });

  describe('map', () => {
    it('transforms the success value', () => {
      expect(map(ok(2), (n) => n * 3)).toEqual(ok(6));
    });

    it('leaves a failure untouched', () => {
      const failure = err('nope');
      const fn = jest.fn();

      expect(map(failure, fn)).toBe(failure);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('mapErr', () => {
    it('transforms the error', () => {
      expect(mapErr(err('low'), (e) => e.toUpperCase())).toEqual(err('LOW'));
    });

    it('leaves a success untouched', () => {
      const success = ok(1);
      const fn = jest.fn();

      expect(mapErr(success, fn)).toBe(success);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('andThen', () => {
    it('chains steps while they succeed', () => {
      const result = andThen(ok(4), (n) => ok(n + 1));

      expect(result).toEqual(ok(5));
    });

    it('short-circuits on the first failure', () => {
      const next = jest.fn();

      expect(andThen(err('stop'), next)).toEqual(err('stop'));
      expect(next).not.toHaveBeenCalled();
    });

    it('propagates a failure raised mid-chain', () => {
      const result = andThen(ok(4), () => err('mid'));

      expect(result).toEqual(err('mid'));
    });
  });

  describe('andThenAsync', () => {
    it('chains an asynchronous step', async () => {
      await expect(andThenAsync(ok(1), (n) => Promise.resolve(ok(n + 1)))).resolves.toEqual(ok(2));
    });

    it('short-circuits without awaiting the step', async () => {
      const next = jest.fn();

      await expect(andThenAsync(err('stop'), next)).resolves.toEqual(err('stop'));
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('tap', () => {
    it('runs the side effect and forwards the success', () => {
      const spy = jest.fn();
      const result = ok('value');

      expect(tap(result, spy)).toBe(result);
      expect(spy).toHaveBeenCalledWith('value');
    });

    it('skips the side effect on a failure', () => {
      const spy = jest.fn();

      tap(err('x'), spy);

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('match', () => {
    it('collapses a success', () => {
      const value = match(ok(3), { onOk: (n) => `ok:${n}`, onErr: (e) => `err:${String(e)}` });

      expect(value).toBe('ok:3');
    });

    it('collapses a failure', () => {
      const value = match(err('bad'), { onOk: (n) => `ok:${String(n)}`, onErr: (e) => `err:${e}` });

      expect(value).toBe('err:bad');
    });
  });

  describe('unwrapOr', () => {
    it('returns the value of a success', () => {
      expect(unwrapOr(ok(7), 0)).toBe(7);
    });

    it('returns the fallback of a failure', () => {
      expect(unwrapOr(err<string>('x'), 0)).toBe(0);
    });
  });

  describe('combine', () => {
    it('collects every value when all succeed', () => {
      expect(combine([ok(1), ok(2), ok(3)])).toEqual(ok([1, 2, 3]));
    });

    it('returns the first failure', () => {
      expect(combine([ok(1), err('first'), err('second')])).toEqual(err('first'));
    });

    it('returns an empty list for no results', () => {
      expect(combine([])).toEqual(ok([]));
    });
  });

  describe('fromPromise', () => {
    it('wraps a resolved promise into the success track', async () => {
      await expect(fromPromise(Promise.resolve('done'), () => 'mapped')).resolves.toEqual(
        ok('done'),
      );
    });

    it('wraps a rejection into the failure track', async () => {
      const cause = new Error('network down');

      await expect(
        fromPromise(Promise.reject(cause), (thrown) => (thrown as Error).message),
      ).resolves.toEqual(err('network down'));
    });
  });
});
