import { type ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';

import { AllExceptionsFilter, type ErrorResponseBody } from './all-exceptions.filter';

const hostFor = (method = 'GET', url = '/api/v1/products') => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });

  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method, url }),
    }),
  } as unknown as ArgumentsHost;

  const body = (): ErrorResponseBody =>
    (json.mock.calls as unknown[][])[0][0] as ErrorResponseBody;

  return { host, status, json, body };
};

describe('AllExceptionsFilter', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  it('keeps the status and code of a domain exception', () => {
    const filter = new AllExceptionsFilter();
    const { host, status, body } = hostFor();

    filter.catch(
      new HttpException({ code: 'PRODUCT_NOT_FOUND', message: 'No existe.' }, HttpStatus.NOT_FOUND),
      host,
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(body()).toMatchObject({
      statusCode: 404,
      code: 'PRODUCT_NOT_FOUND',
      message: 'No existe.',
      path: '/api/v1/products',
    });
  });

  it('forwards the error details when present', () => {
    const filter = new AllExceptionsFilter();
    const { host, body } = hostFor();

    filter.catch(
      new HttpException(
        { code: 'INSUFFICIENT_STOCK', message: 'Sin unidades.', details: { available: 1 } },
        HttpStatus.CONFLICT,
      ),
      host,
    );

    expect(body().details).toEqual({ available: 1 });
  });

  it('collapses the array of validation messages into one line', () => {
    const filter = new AllExceptionsFilter();
    const { host, body } = hostFor('POST', '/api/v1/transactions');

    filter.catch(
      new HttpException(
        { message: ['quantity must be an integer', 'productId must be a UUID'] },
        HttpStatus.BAD_REQUEST,
      ),
      host,
    );

    expect(body().message).toBe('quantity must be an integer; productId must be a UUID');
    expect(body().code).toBe('BAD_REQUEST');
  });

  it('handles an exception carrying a plain string body', () => {
    const filter = new AllExceptionsFilter();
    const { host, body } = hostFor();

    filter.catch(new HttpException('Forbidden resource', HttpStatus.FORBIDDEN), host);

    expect(body()).toMatchObject({ statusCode: 403, code: 'FORBIDDEN', message: 'Forbidden resource' });
  });

  it('hides the internals of an unexpected failure', () => {
    const filter = new AllExceptionsFilter();
    const { host, status, body } = hostFor();

    filter.catch(new Error('connect ECONNREFUSED 10.0.0.5:5432'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(body().message).toBe('An unexpected error occurred.');
    expect(JSON.stringify(body())).not.toContain('ECONNREFUSED');
  });

  it('logs server-side failures with their stack', () => {
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const filter = new AllExceptionsFilter();
    const { host } = hostFor();

    filter.catch(new Error('boom'), host);

    expect(logger).toHaveBeenCalledWith(
      'GET /api/v1/products -> 500',
      expect.stringContaining('Error: boom'),
    );
  });

  it('does not log client errors', () => {
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const filter = new AllExceptionsFilter();
    const { host } = hostFor();

    filter.catch(new HttpException({ code: 'X', message: 'y' }, HttpStatus.BAD_REQUEST), host);

    expect(logger).not.toHaveBeenCalled();
  });

  it('handles a thrown value that is not an Error', () => {
    const filter = new AllExceptionsFilter();
    const { host, body } = hostFor();

    filter.catch('something odd', host);

    expect(body().statusCode).toBe(500);
  });

  it('stamps an ISO timestamp', () => {
    const filter = new AllExceptionsFilter();
    const { host, body } = hostFor();

    filter.catch(new HttpException('nope', HttpStatus.NOT_FOUND), host);

    expect(body().timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
