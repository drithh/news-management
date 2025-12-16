import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { IdempotencyKey } from '@/idempotency/idempotency-key.entity';
import { IdempotencyService } from '@/idempotency/idempotency.service';
import { IdempotencyInterceptor } from '@/idempotency/idempotency.interceptor';
import { KeyValueModule } from '@/key-value/key-value.module';

@Module({
  imports: [TypeOrmModule.forFeature([IdempotencyKey]), KeyValueModule],
  providers: [
    IdempotencyService,
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
  exports: [IdempotencyService],
})
export class IdempotencyModule {}
