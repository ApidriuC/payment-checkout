export interface PersistStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

const memoryStore = new Map<string, string>();

const memoryStorage: PersistStorage = {
  getItem: (key) => Promise.resolve(memoryStore.get(key) ?? null),
  setItem: (key, value) => {
    memoryStore.set(key, value);
    return Promise.resolve();
  },
  removeItem: (key) => {
    memoryStore.delete(key);
    return Promise.resolve();
  },
};

export const isLocalStorageAvailable = (): boolean => {
  try {
    const probe = '__probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
};

/**
 * Own adapter instead of redux-persist/lib/storage: that deep import resolves to
 * the CommonJS build and its default export does not survive the ESM interop.
 * Falling back to memory also keeps the app usable when localStorage is blocked.
 */
export const createPersistStorage = (): PersistStorage => {
  if (typeof window === 'undefined' || !isLocalStorageAvailable()) {
    return memoryStorage;
  }

  return {
    getItem: (key) => Promise.resolve(window.localStorage.getItem(key)),
    setItem: (key, value) => {
      window.localStorage.setItem(key, value);
      return Promise.resolve();
    },
    removeItem: (key) => {
      window.localStorage.removeItem(key);
      return Promise.resolve();
    },
  };
};
