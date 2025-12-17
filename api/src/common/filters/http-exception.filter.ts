import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Check if this is a validation error (from ValidationPipe)
    // ValidationPipe throws BadRequestException with message as array
    const isValidationError =
      status === HttpStatus.BAD_REQUEST &&
      typeof exceptionResponse === 'object' &&
      exceptionResponse !== null &&
      'message' in exceptionResponse &&
      Array.isArray((exceptionResponse as any).message);

    // Format validation errors
    if (isValidationError) {
      response.status(status).json({
        status: 'error',
        message: 'Validation error',
      });
      return;
    }

    // For all other HTTP exceptions, extract the message
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as any).message || 'An error occurred';

    // Format all HTTP exceptions consistently
    response.status(status).json({
      status: 'error',
      message: typeof message === 'string' ? message : 'An error occurred',
    });
  }
}
