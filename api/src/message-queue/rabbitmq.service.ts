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

      const queue = this.configService.get<string>('ARTICLE_JOBS_QUEUE');
      if (!queue) {
        throw new Error('ARTICLE_JOBS_QUEUE is not configured');
      }

      if (!this.channel) {
        throw new Error('RabbitMQ channel is not initialized');
      }

      await this.channel.assertQueue(queue, { durable: true });

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
      // Basic runtime guard: event type must match routing key
      if (event.type !== routingKey) {
        throw new Error(
          `Event type mismatch. routingKey="${String(
            routingKey
          )}", event.type="${event.type}"`
        );
      }

      // Serialize event
      const content = Buffer.from(JSON.stringify(event));
      const queue = this.configService.get<string>('ARTICLE_JOBS_QUEUE');
      if (!queue) {
        throw new Error('ARTICLE_JOBS_QUEUE is not configured');
      }

      // Send to queue
      if (!this.channel) {
        throw new Error('RabbitMQ channel is not initialized');
      }

      this.channel.sendToQueue(queue, content, {
        persistent: true,
        contentType: 'application/json',
        type: event.type,
        headers: {
          routingKey,
        },
      });

      this.logger.log(`Published event "${event.type}"`);
    } catch (error) {
      this.logger.error('Failed to publish message', error);
      throw new ServiceUnavailableException('Failed to queue job');
    }
  }
}
