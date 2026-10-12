import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

/**
 * Domain errors carry a stable machine `code` next to the human message. The
 * platform ApiExceptionFilter copies `code` into the standard error envelope
 * `{ success: false, message, code, requestId, timestamp, path }`, so clients
 * can branch on the code instead of parsing text.
 */
const body = (code: string, message: string) => ({ message, code });

export const providerError = {
  badRequest: (code: string, message: string) =>
    new BadRequestException(body(code, message)),
  unauthorized: (code: string, message: string) =>
    new UnauthorizedException(body(code, message)),
  forbidden: (code: string, message: string) =>
    new ForbiddenException(body(code, message)),
  notFound: (code: string, message: string) =>
    new NotFoundException(body(code, message)),
  conflict: (code: string, message: string) =>
    new ConflictException(body(code, message)),
  unprocessable: (code: string, message: string) =>
    new HttpException(body(code, message), HttpStatus.UNPROCESSABLE_ENTITY),
  badGateway: (code: string, message: string) =>
    new HttpException(body(code, message), HttpStatus.BAD_GATEWAY),
  gone: (code: string, message: string) =>
    new HttpException(body(code, message), HttpStatus.GONE),
  unavailable: (code: string, message: string) =>
    new HttpException(body(code, message), HttpStatus.SERVICE_UNAVAILABLE),
};
