import { HttpException } from "@nestjs/common";

/** A Yatra rule was broken. The message is safe to show to the user. */
export class YatraException extends HttpException {
  constructor(message: string, status = 400, code = "YATRA_ERROR") {
    super({ success: false, message, code }, status);
  }
}
