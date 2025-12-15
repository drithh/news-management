import { Module } from '@nestjs/common';
import { RedisKeyValueService } from '@/key-value/redis-key-value.service';
import { KEY_VALUE_PORT } from '@/key-value/key-value.port';
import { RedisModule } from '@/redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [
    {
      provide: KEY_VALUE_PORT,
      useClass: RedisKeyValueService,
    },
  ],
  exports: [KEY_VALUE_PORT],
})
export class KeyValueModule {}
