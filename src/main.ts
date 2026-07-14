import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module.js';
import { GenexusExceptionFilter } from './common/filters/genexus-exception.filter.js';
import { TransformInterceptor } from './common/interceptors/transform.interceptor.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Habilita @WebSocketGateway (namespace /balanza) — integración de hardware
  app.useWebSocketAdapter(new IoAdapter(app));

  // POST /precios/upload manda el archivo como base64 en JSON (≈ +33% tamaño).
  // Subimos el límite para soportar archivos de precios razonables (~50 MB raw).
  app.use(json({ limit: '75mb' }));
  app.use(urlencoded({ limit: '75mb', extended: true }));

  // CORS: permite al frontend React (POS) comunicarse con el BFF
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'ApiKey',
      'x-pos-token',
      'x-pos-user',
      'x-pos-modo',
      'x-pos-emp-key',
      'x-pos-punto-acceso-key',
      'x-pos-punto-acceso-desc',
      'x-pos-estacion-turno-idl',
      'x-pos-vendedor-key',
      'x-pos-turno-caja-key',
      'x-pos-estacion-es-caja',
    ],
  });

  // Validación global de DTOs (class-validator + class-transformer)
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Middlewares globales
  app.use(cookieParser());

  // Interceptor global: aplana SDTs de GeneXus
  app.useGlobalInterceptors(new TransformInterceptor());

  // Filter global: captura errores de red/parseo sin exponer rutas
  app.useGlobalFilters(new GenexusExceptionFilter());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap();
