import { HttpException } from "@nestjs/common";

export class PilgrimageException extends HttpException {
  constructor(message: string, status: number, code?: string) {
    super({ success: false, message, ...(code ? { code } : {}) }, status);
  }
}
