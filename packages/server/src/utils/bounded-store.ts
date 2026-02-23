/**
 * A Map with bounded size and TTL eviction to prevent memory DoS
 */
export class BoundedStore<K, V> {
  private store = new Map<K, { value: V; expiresAt: number }>();
  private maxSize: number;
  private ttlMs: number;

  constructor(opts: { maxSize: number; ttlMs: number }) {
    this.maxSize = opts.maxSize;
    this.ttlMs = opts.ttlMs;
  }

  get(key: K): V | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    
    return entry.value;
  }

  set(key: K, value: V): void {
    // Evict expired entries first
    this.evictExpired();
    
    // If at max size and key doesn't exist, evict oldest
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    
    this.store.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  delete(key: K): boolean {
    return this.store.delete(key);
  }

  has(key: K): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    this.evictExpired();
    return this.store.size;
  }
}

/**
 * A bounded array store with max items per key
 */
export class BoundedArrayStore<K, V> {
  private store = new Map<K, { items: V[]; expiresAt: number }>();
  private maxKeys: number;
  private maxItemsPerKey: number;
  private ttlMs: number;

  constructor(opts: { maxKeys: number; maxItemsPerKey: number; ttlMs: number }) {
    this.maxKeys = opts.maxKeys;
    this.maxItemsPerKey = opts.maxItemsPerKey;
    this.ttlMs = opts.ttlMs;
  }

  get(key: K): V[] {
    const entry = this.store.get(key);
    if (!entry) return [];
    
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return [];
    }
    
    return entry.items;
  }

  push(key: K, item: V): boolean {
    this.evictExpired();
    
    const entry = this.store.get(key);
    
    if (entry) {
      // Check max items per key
      if (entry.items.length >= this.maxItemsPerKey) {
        return false; // Reject - too many items
      }
      entry.items.push(item);
      entry.expiresAt = Date.now() + this.ttlMs; // Refresh TTL
      return true;
    }
    
    // New key - check max keys
    if (this.store.size >= this.maxKeys) {
      // Evict oldest key
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    
    this.store.set(key, {
      items: [item],
      expiresAt: Date.now() + this.ttlMs,
    });
    return true;
  }

  set(key: K, items: V[]): void {
    this.evictExpired();
    
    if (this.store.size >= this.maxKeys && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    
    // Truncate to max items
    const truncated = items.slice(0, this.maxItemsPerKey);
    
    this.store.set(key, {
      items: truncated,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  retain(key: K, predicate: (item: V) => boolean): V[] {
    const entry = this.store.get(key);
    if (!entry) return [];
    
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return [];
    }
    
    entry.items = entry.items.filter(predicate);
    return entry.items;
  }

  delete(key: K): boolean {
    return this.store.delete(key);
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}
