import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request & { id?: string }>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const raw =
      exception instanceof HttpException ? exception.getResponse() : null;
    const payload =
      typeof raw === "object" && raw !== null
        ? (raw as Record<string, unknown>)
        : {};
    const rawMessage = payload.message;
    const message = Array.isArray(rawMessage)
      ? String(rawMessage[0] ?? "Validation failed")
      : String(
          rawMessage ??
            (typeof raw === "string" ? raw : "Internal server error"),
        );

    response.status(status).json({
      success: false,
      message,
      ...(Array.isArray(rawMessage) ? { errors: rawMessage } : {}),
      ...(payload.code ? { code: payload.code } : {}),
      requestId: request.id,
      timestamp: new Date().toISOString(),
      path: request.originalUrl,
    });
  }
}
