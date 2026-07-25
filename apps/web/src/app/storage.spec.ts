import { createPersistStorage, isLocalStorageAvailable } from './storage';

const realLocalStorage = window.localStorage;

const useLocalStorage = (impl: Partial<Storage>) => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    writable: true,
    value: impl,
  });
};

afterEach(() => {
  useLocalStorage(realLocalStorage);
});

describe('isLocalStorageAvailable', () => {
  it('is true when the browser allows writes', () => {
    expect(isLocalStorageAvailable()).toBe(true);
  });

  it('is false when writing throws, as in private browsing', () => {
    useLocalStorage({
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: jest.fn(),
    });

    expect(isLocalStorageAvailable()).toBe(false);
  });

  it('leaves no probe key behind', () => {
    isLocalStorageAvailable();

    expect(window.localStorage.getItem('__probe__')).toBeNull();
  });
});

describe('createPersistStorage', () => {
  it('exposes the three methods redux-persist calls', () => {
    const storage = createPersistStorage();

    expect(typeof storage.getItem).toBe('function');
    expect(typeof storage.setItem).toBe('function');
    expect(typeof storage.removeItem).toBe('function');
  });

  it('round-trips a value through localStorage', async () => {
    const storage = createPersistStorage();

    await storage.setItem('persist:checkout', '{"step":"details"}');

    await expect(storage.getItem('persist:checkout')).resolves.toBe('{"step":"details"}');
    expect(window.localStorage.getItem('persist:checkout')).toBe('{"step":"details"}');
  });

  it('resolves to null for a key that was never written', async () => {
    await expect(createPersistStorage().getItem('nope')).resolves.toBeNull();
  });

  it('removes a stored value', async () => {
    const storage = createPersistStorage();
    await storage.setItem('persist:checkout', 'algo');

    await storage.removeItem('persist:checkout');

    await expect(storage.getItem('persist:checkout')).resolves.toBeNull();
  });

  it('falls back to memory when localStorage is blocked', async () => {
    useLocalStorage({
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: jest.fn(),
      getItem: () => {
        throw new Error('blocked');
      },
    });

    const storage = createPersistStorage();
    await storage.setItem('persist:checkout', 'en memoria');

    await expect(storage.getItem('persist:checkout')).resolves.toBe('en memoria');
  });

  it('keeps the app usable when persistence is unavailable', async () => {
    useLocalStorage({
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: jest.fn(),
    });

    const storage = createPersistStorage();

    await expect(storage.getItem('cualquiera')).resolves.toBeNull();
    await expect(storage.removeItem('cualquiera')).resolves.toBeUndefined();
  });
});
