export interface NewsCreatedEvent {
  id: string;
  title: string;
  content: string;
  source: string;
  link: string;
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
   * Publish a domain event to the appropriate infrastructure queue based on
   * the routing key. Application modules should prefer higher-level helpers
   * (e.g. publishArticleCreated) where available, instead of passing queue
   * names around.
   */
  /**
   * Publish a domain event using a strongly-typed routing key.
   *
   * Example:
   * this.mq.publish('news.created', event);
   */
  abstract publish<K extends keyof EventMap>(
    routingKey: K,
    event: EventMap[K]
  ): Promise<void>;

  /**
   * Convenience helper for article-related events so that article modules
   * never need to know about queue names or routing maps.
   */
  publishArticleCreated(payload: NewsCreatedEvent): Promise<void> {
    return this.publish('news.created', payload);
  }
}

export const MESSAGE_QUEUE_PORT = Symbol('MESSAGE_QUEUE_PORT');
