export interface NewsCreatedEvent {
  type: 'news.created';
  payload: {
    id: string;
    title: string;
    content: string;
    /**
     * ISO timestamp when the news/article was published.
     * In this service we currently derive it from the article creation time.
     */
    publishedAt: string;
  };
}

/**
 * Central place to declare all domain events that this service can publish.
 *
 * Each key is the routing key / event name, and the value is the
 * corresponding strongly typed event payload.
 */
export interface EventMap {
  'news.created': NewsCreatedEvent;
}

export abstract class MessageQueuePort {
  /**
   * Publish a domain event using a strongly-typed routing key.
   *
   * Example:
   * this.mq.publish('news.created', {
   *   type: 'news.created',
   *   payload: { ... }
   * });
   */
  abstract publish<K extends keyof EventMap>(
    routingKey: K,
    event: EventMap[K]
  ): Promise<void>;
}

export const MESSAGE_QUEUE_PORT = Symbol('MESSAGE_QUEUE_PORT');
