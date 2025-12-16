import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { EventMap, MessageQueuePort } from '@/message-queue/message-queue.port';

@Injectable()
export class RabbitmqService
  extends MessageQueuePort
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RabbitmqService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private readonly queues: Partial<Record<keyof EventMap, string>> = {
    'news.created': 'news.created',
  };

  constructor(private readonly configService: ConfigService) {
    super();
  }

  async onModuleInit() {
    try {
      const url = this.configService.get<string>('RABBITMQ_URL');
      if (!url) {
        throw new Error('RABBITMQ_URL is not configured');
      }

      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();

      if (!this.channel) {
        throw new Error('RabbitMQ channel is not initialized');
      }

      // Assert all queues from the routing map so they are ready for use
      for (const queue of new Set(Object.values(this.queues))) {
        await this.channel.assertQueue(queue, { durable: true });
      }

      this.logger.log('Successfully connected to RabbitMQ');
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      if (this.channel) {
        await this.channel.close();
      }

      if (this.connection && typeof this.connection.close === 'function') {
        await this.connection.close();
      }
      this.logger.log('RabbitMQ connection closed');
    } catch (error) {
      this.logger.error('Error closing RabbitMQ connection', error);
    }
  }

  async publish<K extends keyof EventMap>(
    routingKey: K,
    event: EventMap[K]
  ): Promise<void> {
    try {
      // Serialize event
      const content = Buffer.from(JSON.stringify(event));
      // Send to queue
      if (!this.channel) {
        throw new Error('RabbitMQ channel is not initialized');
      }

      const queue = this.queues[routingKey];
      if (!queue) {
        throw new Error(
          `No queue configured for routing key "${String(routingKey)}"`
        );
      }

      this.channel.sendToQueue(queue, content, {
        persistent: true,
        contentType: 'application/json',
        type: routingKey,
        headers: {
          routingKey,
        },
      });

      this.logger.log(`Published event "${routingKey}"`);
    } catch (error) {
      this.logger.error('Failed to publish message', error);
      throw new ServiceUnavailableException('Failed to queue job');
    }
  }
}
