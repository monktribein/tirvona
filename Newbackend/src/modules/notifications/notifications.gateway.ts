import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { corsOriginsFromEnvironment } from "../../config/environment";

const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) return true;
  const normalized = origin.trim().replace(/\/+$/, "");
  const allowed = corsOriginsFromEnvironment();
  if (allowed.includes(normalized)) return true;
  if (/^https:\/\/([a-zA-Z0-9-]+\.)*tirvona\.com$/.test(normalized)) return true;
  if (/^http:\/\/localhost:[0-9]+$/.test(normalized)) return true;
  if (/^http:\/\/127\.0\.0\.1:[0-9]+$/.test(normalized)) return true;
  return false;
};

@Injectable()
@WebSocketGateway({
  namespace: "/notifications",
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer() server: Server;
  constructor(private readonly jwt: JwtService) {}
  async handleConnection(client: Socket): Promise<void> {
    try {
      const raw = String(
        client.handshake.auth?.token ??
          client.handshake.headers.authorization ??
          "",
      ).replace(/^Bearer\s+/i, "");
      const payload: any = await this.jwt.verifyAsync(raw);
      await client.join(`user:${payload.sub ?? payload.id}`);
    } catch {
      client.disconnect(true);
    }
  }
  send(userId: string, event: string, payload: unknown): void {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }
}
