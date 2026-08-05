import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

interface HttpErrorResponse {
  status: (code: number) => HttpErrorResponse;
  json: (body: unknown) => void;
}

const GENERIC_INTERNAL_ERROR = {
  statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
  message: 'Internal server error',
} as const;

function isPrismaError(exception: unknown): boolean {
  return (
    exception instanceof Prisma.PrismaClientKnownRequestError ||
    exception instanceof Prisma.PrismaClientUnknownRequestError ||
    exception instanceof Prisma.PrismaClientValidationError ||
    exception instanceof Prisma.PrismaClientInitializationError ||
    exception instanceof Prisma.PrismaClientRustPanicError
  );
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpErrorResponse>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      response.status(status).json(exceptionResponse);
      return;
    }

    if (isPrismaError(exception)) {
      this.logger.error('Database error suppressed from client response');
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(GENERIC_INTERNAL_ERROR);
      return;
    }

    this.logger.error('Unhandled error suppressed from client response');
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(GENERIC_INTERNAL_ERROR);
  }
}
