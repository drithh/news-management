import { Module } from '@nestjs/common';
import { RabbitmqService } from '@/message-queue/rabbitmq.service';
import { MESSAGE_QUEUE_PORT } from '@/message-queue/message-queue.port';

@Module({
  providers: [
    {
      provide: MESSAGE_QUEUE_PORT,
      useClass: RabbitmqService,
    },
  ],
  exports: [MESSAGE_QUEUE_PORT],
})
export class MessageQueueModule {}
