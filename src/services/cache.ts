const cache = new Map<string, { data: unknown; timestamp: number }>();

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function get<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.timestamp > DEFAULT_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

export function set(key: string, data: unknown): void {
  cache.set(key, { data, timestamp: Date.now() });
}
