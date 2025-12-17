import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import {
  EventEnvelope,
  EventMap,
  MessageQueuePort,
} from '@/message-queue/message-queue.port';

@Injectable()
export class RabbitmqService
  extends MessageQueuePort
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RabbitmqService.name);
  private readonly exchange = 'news.events';
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

      if (!this.channel) {
        throw new Error('RabbitMQ channel is not initialized');
      }

      // Declare the main exchange used for domain events
      await this.channel.assertExchange(this.exchange, 'topic', {
        durable: true,
      });

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
      if (!this.channel) {
        throw new Error('RabbitMQ channel is not initialized');
      }

      // Wrap the event payload in a standard envelope
      const envelope: EventEnvelope<EventMap[K]> = {
        event: String(routingKey),
        version: 1,
        event_id: uuidv4(),
        data: event,
      };

      const content = Buffer.from(JSON.stringify(envelope));

      this.channel.publish(this.exchange, String(routingKey), content, {
        persistent: true,
        contentType: 'application/json',
        type: routingKey,
        messageId: envelope.event_id,
        headers: {
          routingKey,
          event: envelope.event,
          version: envelope.version,
          event_id: envelope.event_id,
        },
      });

      this.logger.log(
        `Published event "${routingKey}" with id ${envelope.event_id}`
      );
    } catch (error) {
      this.logger.error('Failed to publish message', error);
      throw new ServiceUnavailableException('Failed to queue job');
    }
  }
}
