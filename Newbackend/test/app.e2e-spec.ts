import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { setServers } from "node:dns";
import request from "supertest";
import { AppModule } from "../src/app.module";

describe("production API smoke checks", () => {
  let app: INestApplication;

  beforeAll(async () => {
    if (process.env.DNS_SERVERS)
      setServers(
        process.env.DNS_SERVERS.split(",")
          .map((server) => server.trim())
          .filter(Boolean),
      );
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix("api");
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("reports all required dependencies as ready", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/health/ready")
      .expect(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { status: "ready", checks: { database: true, redis: true } },
    });
  });

  it("rejects protected APIs without a bearer token", async () => {
    await request(app.getHttpServer()).get("/api/users").expect(401);
  });
});
