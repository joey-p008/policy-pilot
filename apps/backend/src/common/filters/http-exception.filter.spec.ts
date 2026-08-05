import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();
  const status = jest.fn();
  const json = jest.fn();

  const response = {
    status,
    json,
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  beforeEach(() => {
    status.mockReset();
    json.mockReset();
    status.mockReturnValue(response);
  });

  it('returns a generic 500 for Prisma errors without leaking stack or schema meta', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed on the fields: (`request_id`)',
      {
        code: 'P2002',
        clientVersion: 'test',
        meta: {
          modelName: 'IdempotencyKey',
          target: ['request_id'],
        },
      },
    );
    prismaError.stack =
      'PrismaClientKnownRequestError: Unique constraint failed\n    at IdempotencyKeyRepository.create';

    filter.catch(prismaError, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
    });

    const body = json.mock.calls[0][0] as Record<string, unknown>;
    const serialized = JSON.stringify(body);

    expect(serialized).not.toContain('stack');
    expect(serialized).not.toContain('PrismaClientKnownRequestError');
    expect(serialized).not.toContain('IdempotencyKey');
    expect(serialized).not.toContain('request_id');
    expect(serialized).not.toContain('P2002');
    expect(serialized).not.toContain('meta');
    expect(body).not.toHaveProperty('stack');
    expect(body).not.toHaveProperty('meta');
    expect(body).not.toHaveProperty('code');
  });

  it('returns a generic 500 for unexpected errors without leaking stack traces', () => {
    const error = new Error('connection refused to postgres://localhost/policy_pilot');
    error.stack =
      'Error: connection refused to postgres://localhost/policy_pilot\n    at DatabaseModule.connect';

    filter.catch(error, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
    });

    const body = json.mock.calls[0][0] as Record<string, unknown>;
    const serialized = JSON.stringify(body);

    expect(serialized).not.toContain('stack');
    expect(serialized).not.toContain('postgres://');
    expect(serialized).not.toContain('DatabaseModule');
    expect(body).not.toHaveProperty('stack');
  });

  it('preserves BadRequestException status and body for Zod validation failures', () => {
    const validationBody = {
      message: 'Validation failed',
      errors: {
        fieldErrors: {
          requestId: ['String must contain at least 1 character(s)'],
        },
        formErrors: [] as string[],
      },
    };
    const exception = new BadRequestException(validationBody);

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(validationBody);
  });
});
