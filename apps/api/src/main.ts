import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', 4000);
  const corsOrigins = configService.get<string[]>('corsOrigins', [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);

  // Middlewares essenciais de segurança
  app.use(cookieParser());
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Prefixo Global da API REST
  app.setGlobalPrefix('api/v1');

  // Validação Global estrita
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Documentação OpenAPI / Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('FINN AI — API REST')
    .setDescription('Documentação dos endpoints do Gerente Financeiro Familiar com IA')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addCookieAuth('finn_session')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  await app.listen(port);
  logger.log(`🚀 FINN AI API rodando na porta ${port}`);
  logger.log(`📚 Swagger OpenAPI disponível em: http://localhost:${port}/docs`);
  logger.log(`🩺 Health check disponível em: http://localhost:${port}/api/v1/health`);
}

bootstrap();

