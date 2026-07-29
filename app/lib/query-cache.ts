const store = new Map<string, unknown>();

export const cache_get = <T>(key: string): T | undefined =>
  store.get(key) as T | undefined;

export const cache_set = <T>(key: string, data: T) => {
  store.set(key, data);
};
