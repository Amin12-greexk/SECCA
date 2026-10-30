import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import multipart from '@fastify/multipart';
import { MAX_EXCEL_UPLOAD_BYTES } from './common/upload';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    // Di belakang Traefik (Dokploy): tanpa ini request.ip = alamat proxy, jadi
    // semua mitra terbaca satu IP dan batas percobaan login terkunci untuk
    // semua orang sekaligus. 1 = percaya satu proxy (Traefik), IP klien diambil
    // dari entri X-Forwarded-For yang ia tambahkan.
    new FastifyAdapter({ trustProxy: 1 }),
  );

  // Upload Excel dashboard performa (POST /api/audit-dashboard/import).
  await app.register(multipart, {
    limits: { fileSize: MAX_EXCEL_UPLOAD_BYTES, files: 1 },
  });

  app.enableCors({
    origin: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());

  const config = new DocumentBuilder()
    .setTitle('Secca API')
    .setDescription('Secca backend services')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = Number(process.env.APP_PORT ?? 3001);
  await app.listen(port, '0.0.0.0');
}
bootstrap();

// reload trigger
