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
    // Errors raised outside Nest still carry a meaningful status — body-parser
    // reports 413 for an oversized payload, for instance. Reporting those as
    // 500 hides what the caller actually needs to fix.
    const carried = (exception as { status?: unknown; statusCode?: unknown })
      ?.status;
    const carriedCode = (exception as { statusCode?: unknown })?.statusCode;
    const foreignStatus = [carried, carriedCode].find(
      (value) =>
        typeof value === "number" && value >= 400 && value <= 599,
    ) as number | undefined;
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : (foreignStatus ?? HttpStatus.INTERNAL_SERVER_ERROR);
    const raw =
      exception instanceof HttpException
        ? exception.getResponse()
        : foreignStatus && exception instanceof Error
          ? { message: exception.message }
          : null;
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
