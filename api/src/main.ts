import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '@/app.module';
import { HttpExceptionFilter } from '@/common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger(bootstrap.name);
  const app = await NestFactory.create(AppModule);

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    })
  );

  // Global exception filter for all HTTP exceptions
  app.useGlobalFilters(new HttpExceptionFilter());

  // Set global prefix
  app.setGlobalPrefix('api');

  // OpenAPI / Swagger docs
  const config = new DocumentBuilder()
    .setTitle('News Management API')
    .setDescription('REST API for managing news articles and search.')
    .setVersion('1.0.0')
    .addServer('http://localhost:3000', 'API Base URL')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  logger.log(`API is running on: http://localhost:${port}/api`);

  logger.log(`OpenAPI docs available at: http://localhost:${port}/api/docs`);
}

bootstrap();
