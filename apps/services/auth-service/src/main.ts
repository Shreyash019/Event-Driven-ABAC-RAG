import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import type { ApiDocsConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Trust the gateway proxy so `Secure` cookies and the protocol are honored behind it.
  app.set('trust proxy', 1);

  // Whitelist strips unknown body fields (a client cannot smuggle identity scope into a
  // DTO, GUARDRAILS §1.3); transform applies class-validator coercion to typed DTOs.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // OpenAPI/Swagger docs — mounted only when enabled (off in production by default).
  const apiDocs = app.get(ConfigService).getOrThrow<ApiDocsConfig>('apiDocs');
  if (apiDocs.enabled) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('auth-service API')
        .setDescription('Login, token issue/refresh, JWKS for the ARAC platform.')
        .setVersion('0.0.1')
        .build(),
    );
    SwaggerModule.setup(apiDocs.path, app, document);
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
