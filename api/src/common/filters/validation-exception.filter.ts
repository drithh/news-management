import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();

    const exceptionResponse = exception.getResponse();

    // ValidationPipe throws BadRequestException with message as array
    // Check if message is an array (validation errors from ValidationPipe)
    const isValidationError =
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse &&
      Array.isArray((exceptionResponse as any).message);

    // Return the simple format for validation errors
    if (isValidationError) {
      response.status(status).json({
        status: 'error',
        message: 'Validation error',
      });
      return;
    }

    // For other BadRequestExceptions, use the original message
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any).message || 'Bad request';

    response.status(status).json({
      status: 'error',
      message: typeof message === 'string' ? message : 'Bad request',
    });
  }
}
