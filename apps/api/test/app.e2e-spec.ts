import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import request from "supertest";
import { App } from "supertest/types";
import { AppModule } from "./../src/app.module";
import { ResponseInterceptor } from "../src/common/interceptors/response.interceptor";

describe("AppController (e2e)", () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.setGlobalPrefix("api");
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("/ (GET)", async () => {
    await request(app.getHttpServer())
      .get("/api")
      .expect(200)
      .expect(({ body }) => {
        expect(body.data).toEqual({ status: "ok" });
      });
  });
});
