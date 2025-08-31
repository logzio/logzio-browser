import { LocalStorageStore } from '@src/utils/Store';
import { rumLogger } from '@src/shared/Logger';

// Mock the logger
jest.mock('@src/shared/Logger', () => ({
  rumLogger: {
    error: jest.fn(),
  },
}));

describe('LocalStorageStore', () => {
  let mockLocalStorage: { [key: string]: string };
  let localStorageMock: Storage;

  beforeEach(() => {
    mockLocalStorage = {};
    localStorageMock = {
      getItem: jest.fn((key: string) => mockLocalStorage[key] || null),
      setItem: jest.fn((key: string, value: string) => {
        mockLocalStorage[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete mockLocalStorage[key];
      }),
      clear: jest.fn(() => {
        mockLocalStorage = {};
      }),
      length: 0,
      key: jest.fn(() => null),
    };

    Object.defineProperty(global, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });

    jest.clearAllMocks();
  });

  describe('basic operations', () => {
    it('should store and retrieve values', () => {
      LocalStorageStore.set('testKey', 'testValue');
      expect(mockLocalStorage['testKey']).toBe('testValue');

      const result = LocalStorageStore.get('testKey');
      expect(result).toBe('testValue');
    });

    it('should return null for non-existent keys', () => {
      expect(LocalStorageStore.get('nonExistent')).toBeNull();
    });

    it('should remove keys', () => {
      LocalStorageStore.set('testKey', 'testValue');
      LocalStorageStore.remove('testKey');
      expect(LocalStorageStore.get('testKey')).toBeNull();
    });

    it('should handle localStorage errors gracefully', () => {
      (localStorageMock.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });

      expect(() => LocalStorageStore.set('testKey', 'testValue')).not.toThrow();
      expect(rumLogger.error).toHaveBeenCalled();
    });

    it('should handle complete workflow', () => {
      // Set -> Get -> Remove -> Get
      LocalStorageStore.set('key', 'value');
      expect(LocalStorageStore.get('key')).toBe('value');

      LocalStorageStore.remove('key');
      expect(LocalStorageStore.get('key')).toBeNull();
    });
  });
});
