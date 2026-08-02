import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { corsOriginsFromEnvironment } from "../../config/environment";
@Injectable()
@WebSocketGateway({
  namespace: "/notifications",
  cors: {
    origin: corsOriginsFromEnvironment(),
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
