/**
 * Port (interface) for key-value storage operations.
 * Abstracts away the underlying implementation (Redis, Memcached, etc.)
 * following the Ports & Adapters (Hexagonal) architecture pattern.
 */
export abstract class KeyValuePort {
  /**
   * Get a value by key
   * @returns The value if found, null if not found
   */
  abstract get(key: string): Promise<string | null>;

  /**
   * Set a key-value pair
   */
  abstract set(key: string, value: string): Promise<void>;

  /**
   * Set a key-value pair with TTL (time to live) in seconds
   */
  abstract setex(key: string, ttl: number, value: string): Promise<void>;

  /**
   * Delete a key
   * @returns true if key was deleted, false if key didn't exist
   */
  abstract del(key: string): Promise<boolean>;

  /**
   * Check if a key exists
   */
  abstract exists(key: string): Promise<boolean>;

  /**
   * Set a key only if it does not exist (atomic operation)
   * @returns true if key was set, false if key already exists
   */
  abstract setnx(key: string, value: string): Promise<boolean>;

  /**
   * Get the TTL (time to live) of a key in seconds
   * @returns TTL in seconds, -1 if key exists but has no expiry, -2 if key doesn't exist
   */
  abstract ttl(key: string): Promise<number>;

  /**
   * Set expiry on a key
   * @returns true if expiry was set, false if key doesn't exist
   */
  abstract expire(key: string, ttl: number): Promise<boolean>;
}

export const KEY_VALUE_PORT = Symbol('KEY_VALUE_PORT');

