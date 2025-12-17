import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from '@/health/health.module';
import { SearchModule } from '@/search/search.module';
import { RedisModule } from '@/redis/redis.module';
import { IdempotencyModule } from '@/idempotency/idempotency.module';
import { KeyValueModule } from '@/key-value/key-value.module';
import { MessageQueueModule } from '@/message-queue/message-queue.module';
import { ArticleModule } from '@/article/article.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get('POSTGRES_URL'),
        autoLoadEntities: true,
        synchronize: configService.get('NODE_ENV') === 'development',
        migrations: ['dist/migrations/*.js'],
        migrationsRun: true,
        logging: ['error', 'warn'],
      }),
    }),
    RedisModule,
    IdempotencyModule,
    KeyValueModule,
    MessageQueueModule,
    ArticleModule,
    HealthModule,
    SearchModule,
  ],
})
export class AppModule {}
