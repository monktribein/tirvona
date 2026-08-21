import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";

const databaseFailure = (
  exception: unknown,
): { status: number; message: string } | null => {
  const error = exception as {
    name?: string;
    code?: number;
    message?: string;
    errors?: Record<string, { message?: string }>;
    path?: string;
    keyValue?: Record<string, unknown>;
  };
  if (error?.name === "ValidationError") {
    const first = Object.values(error.errors ?? {})[0]?.message;
    return {
      status: HttpStatus.BAD_REQUEST,
      message: first ?? "The submitted record is not valid",
    };
  }
  if (error?.name === "CastError")
    return {
      status: HttpStatus.BAD_REQUEST,
      message: `"${error.path ?? "value"}" is not in a valid format`,
    };
  if (error?.name === "VersionError")
    return {
      status: HttpStatus.CONFLICT,
      message: "This record changed while you were editing it. Reload and retry.",
    };
  if (error?.code === 11000) {
    const field = Object.keys(error.keyValue ?? {})[0];
    return {
      status: HttpStatus.CONFLICT,
      message: field
        ? `That ${field} is already in use`
        : "That record already exists",
    };
  }
  return null;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request & { id?: string }>();

    const database =
      exception instanceof HttpException ? null : databaseFailure(exception);
    if (database) {
      response.status(database.status).json({
        success: false,
        message: database.message,
        requestId: request.id,
        timestamp: new Date().toISOString(),
        path: request.originalUrl,
      });
      return;
    }
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
