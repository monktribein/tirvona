import {
  Controller,
  Get,
  Header,
  OnModuleDestroy,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectConnection } from "@nestjs/mongoose";
import Redis from "ioredis";
import type { Connection } from "mongoose";
import { Public } from "./decorators/public.decorator";

@Controller("health")
export class HealthController implements OnModuleDestroy {
  private readonly redis: Redis;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    config: ConfigService,
  ) {
    this.redis = new Redis(config.getOrThrow<string>("redisUrl"), {
      lazyConnect: true,
      connectTimeout: 2_000,
      commandTimeout: 2_000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    this.redis.on("error", () => undefined);
  }

  onModuleDestroy(): void {
    this.redis.disconnect();
  }

  @Public()
  @Get("live")
  @Header("Cache-Control", "no-store")
  live(): Record<string, unknown> {
    return {
      success: true,
      data: {
        service: "tirvona-api",
        status: "alive",
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Public()
  @Get()
  @Header("Cache-Control", "no-store")
  status(): Promise<Record<string, unknown>> {
    return this.ready();
  }

  @Public()
  @Get("ready")
  @Header("Cache-Control", "no-store")
  async ready(): Promise<Record<string, unknown>> {
    const checks = { database: false, redis: false };
    try {
      if (this.connection.readyState === 1) {
        await this.connection.db?.admin().ping();
        checks.database = true;
      }
    } catch {
      checks.database = false;
    }
    try {
      if (["wait", "end"].includes(this.redis.status))
        await this.redis.connect();
      await this.redis.ping();
      checks.redis = true;
    } catch {
      checks.redis = false;
    }
    const data = {
      service: "tirvona-api",
      status: checks.database && checks.redis ? "ready" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    };
    if (!checks.database || !checks.redis)
      throw new ServiceUnavailableException({
        message: "Service dependencies are not ready",
        data,
      });
    return {
      success: true,
      data,
    };
  }
}
