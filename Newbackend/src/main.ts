import {
  ValidationPipe,
  VERSION_NEUTRAL,
  VersioningType,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import compression from "compression";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { ConfigService } from "@nestjs/config";
import { AppModule } from "./app.module";
import { applyDnsServersFromEnvironment } from "./config/environment";
import { ApiExceptionFilter } from "./common/filters/api-exception.filter";
import { RequestIdInterceptor } from "./common/interceptors/request-id.interceptor";

async function bootstrap(): Promise<void> {
  const isProduction = process.env.NODE_ENV === "production";
  applyDnsServersFromEnvironment();

  const app = await NestFactory.create(AppModule, {
    rawBody: true,
    bufferLogs: isProduction,
    logger: isProduction ? undefined : ["error", "warn", "log"],
  });
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  if (isProduction) app.useLogger(app.get(Logger));
  app.setGlobalPrefix("api", {
    exclude: ["robots.txt", "sitemap.xml"],
  });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: VERSION_NEUTRAL,
  });
  app.use(helmet());
  app.use(compression());
  if (config.get<boolean>("trustProxy"))
    app.getHttpAdapter().getInstance().set("trust proxy", 1);
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      const configured = config.get<string[]>("corsOrigins") ?? [];
      const normalized = origin.trim().replace(/\/+$/, "");
      const allowed = [
        "https://tirvona.com",
        "https://www.tirvona.com",
        "https://api.tirvona.com",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:3000",
        ...configured,
      ];
      if (
        allowed.includes(normalized) ||
        /^https:\/\/([a-zA-Z0-9-]+\.)*tirvona\.com$/.test(normalized) ||
        /^http:\/\/localhost:[0-9]+$/.test(normalized) ||
        /^http:\/\/127\.0\.0\.1:[0-9]+$/.test(normalized)
      ) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-Request-Id",
      "X-Session-Id",
    ],
    maxAge: 86_400,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: false,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new RequestIdInterceptor());

  if (config.get<boolean>("swaggerEnabled")) {
    const swagger = new DocumentBuilder()
      .setTitle("Tirvona API")
      .setDescription("Frontend-compatible Tirvona platform API")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    SwaggerModule.setup(
      "api/docs",
      app,
      SwaggerModule.createDocument(app, swagger),
    );
  }

  const port = config.get<number>("port") ?? 5000;
  await app.listen(port, config.get<string>("host") ?? "0.0.0.0");
  const server = app.getHttpServer();
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 185_000;
  server.requestTimeout = 180_000;
  if (!isProduction)
    process.stdout.write(
      `Tirvona API ready: http://localhost:${port}/api\n` +
        `Health check: http://localhost:${port}/api/health\n`,
    );
}

void bootstrap().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`Tirvona API failed to start: ${message}\n`);
  process.exitCode = 1;
});
