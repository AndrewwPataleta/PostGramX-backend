// src/main.ts
import 'reflect-metadata'; // ← обязательно первой строкой

import { loadEnvConfig } from './config/env';
import { json, urlencoded } from 'express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  // eslint-disable-next-line no-console
  console.log('🧭 Bootstrap start');
  loadEnvConfig();
  // eslint-disable-next-line no-console
  console.log('✅ Env config loaded');

  const app = await NestFactory.create(AppModule);
  // eslint-disable-next-line no-console
  console.log('✅ Nest application created');

  const bodyLimit = process.env.REQUEST_BODY_LIMIT || '50mb';
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));
  app.enableCors();
  // eslint-disable-next-line no-console
  console.log(`✅ Express middlewares registered (bodyLimit=${bodyLimit})`);

  // Swagger только для local/stage
  if (['local', 'stage'].includes(process.env.NODE_ENV || '')) {
    const config = new DocumentBuilder()
      .setTitle('Nest JS Telegram Template API')
      .setDescription('API documentation for the Telegram-focused template')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('swagger', app, document);
    // eslint-disable-next-line no-console
    console.log('✅ Swagger initialized');
  }

  const port = parseInt(process.env.PORT || '80', 10);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`🚀 Server running on http://localhost:${port}`);
}
bootstrap();
