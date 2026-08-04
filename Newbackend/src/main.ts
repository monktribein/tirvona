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
// Importing AppModule evaluates ConfigModule.forRoot(), which loads .env into
// process.env — so DNS_SERVERS is readable by the time bootstrap() runs.
import { AppModule } from "./app.module";
import { applyDnsServersFromEnvironment } from "./config/environment";
import { ApiExceptionFilter } from "./common/filters/api-exception.filter";
import { RequestIdInterceptor } from "./common/interceptors/request-id.interceptor";

async function bootstrap(): Promise<void> {
  const isProduction = process.env.NODE_ENV === "production";
  applyDnsServersFromEnvironment();

  const app = await NestFactory.create(AppModule, {
    bufferLogs: isProduction,
    logger: isProduction ? undefined : ["error", "warn"],
  });
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  if (isProduction) app.useLogger(app.get(Logger));
  app.setGlobalPrefix("api");
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: VERSION_NEUTRAL,
  });
  app.use(helmet());
  app.use(compression());
  if (config.get<boolean>("trustProxy"))
    app.getHttpAdapter().getInstance().set("trust proxy", 1);
  app.enableCors({
    origin: config.get<string[]>("corsOrigins") ?? ["http://localhost:5173"],
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
  server.headersTimeout = 66_000;
  server.requestTimeout = 30_000;
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
