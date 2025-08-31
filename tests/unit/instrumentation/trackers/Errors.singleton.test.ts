/**
 * @jest-environment jsdom
 */
import { resetErrorTracker } from '../../__utils__/errorsTrackerHelpers';

// Mock the shared dependencies
const mockRumLoggerError = jest.fn();
jest.mock('@src/shared', () => ({
  rumLogger: {
    error: mockRumLoggerError,
  },
  DOM_EVENT: {
    ERROR: 'error',
    UNHANDLED_REJECTION: 'unhandledrejection',
  },
  EventListener: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    remove: jest.fn(),
  })),
}));

describe('ErrorTracker Singleton Behavior', () => {
  let ErrorTracker: any;

  beforeEach(() => {
    // Get ErrorTracker class (first time loads, subsequent reuses)
    if (!ErrorTracker) {
      ErrorTracker = jest.requireActual('@src/instrumentation/trackers/Errors').ErrorTracker;
    }

    // Reset singleton state
    resetErrorTracker();

    // Clear mock call history
    mockRumLoggerError.mockClear();
  });

  describe('getInstance', () => {
    it('should return same instance on consecutive calls', () => {
      const instance1 = ErrorTracker.getInstance();
      const instance2 = ErrorTracker.getInstance();

      expect(instance1).toBe(instance2);
      expect(instance1).toBeDefined();
      expect(typeof instance1.subscribe).toBe('function');
    });

    it('should create new instance after manual singleton reset', () => {
      const instance1 = ErrorTracker.getInstance();

      // Manually reset the singleton
      resetErrorTracker();

      const instance2 = ErrorTracker.getInstance();

      expect(instance1).not.toBe(instance2);
      expect(instance2).toBeDefined();
      expect(typeof instance2.subscribe).toBe('function');
    });

    it('should always return valid ErrorTracker instance', () => {
      const instance = ErrorTracker.getInstance();

      expect(instance).toBeDefined();
      expect(instance.constructor.name).toBe('ErrorTracker');
      expect(typeof instance.subscribe).toBe('function');
    });
  });

  describe('no-throw policy', () => {
    it('should never throw in getInstance', () => {
      expect(() => ErrorTracker.getInstance()).not.toThrow();
      expect(() => ErrorTracker.getInstance()).not.toThrow();
      expect(() => ErrorTracker.getInstance()).not.toThrow();
    });

    it('should work even after errors in other operations in getInstance', () => {
      const tracker = ErrorTracker.getInstance();

      // Try to cause some error by calling with invalid args
      try {
        (tracker as any).nonExistentMethod?.();
      } catch {
        // Ignore intentional error
      }

      // getInstance should still work
      expect(() => ErrorTracker.getInstance()).not.toThrow();
      const instance = ErrorTracker.getInstance();
      expect(instance).toBeDefined();
    });

    it('should never throw in multiple resets and getInstance calls', () => {
      for (let i = 0; i < 5; i++) {
        expect(() => ErrorTracker.getInstance()).not.toThrow();
        expect(() => resetErrorTracker()).not.toThrow();
      }
    });
  });

  describe('singleton state management', () => {
    it('should preserve state across getInstance calls', () => {
      const tracker1 = ErrorTracker.getInstance();
      const handler = jest.fn();

      // Subscribe a handler
      const unsubscribe = tracker1.subscribe(handler);

      // Get instance again
      const tracker2 = ErrorTracker.getInstance();

      // Should be same instance with preserved state
      expect(tracker1).toBe(tracker2);
      expect(typeof unsubscribe).toBe('function');
    });

    it('should reset state after singleton reset', () => {
      const tracker1 = ErrorTracker.getInstance();
      const handler = jest.fn();
      tracker1.subscribe(handler);

      // Reset singleton
      resetErrorTracker();

      // Get new instance
      const tracker2 = ErrorTracker.getInstance();

      // Should be different instance with fresh state
      expect(tracker1).not.toBe(tracker2);
    });
  });

  describe('instance identity', () => {
    it('should maintain singleton contract across multiple calls', () => {
      const instances = Array.from({ length: 10 }, () => ErrorTracker.getInstance());

      // All instances should be identical
      instances.forEach((instance) => {
        expect(instance).toBe(instances[0]);
      });
    });

    it('should create truly new instance after singleton reset', () => {
      const instances1 = Array.from({ length: 3 }, () => ErrorTracker.getInstance());

      resetErrorTracker();

      const instances2 = Array.from({ length: 3 }, () => ErrorTracker.getInstance());

      // All instances in first group should be identical
      instances1.forEach((instance) => {
        expect(instance).toBe(instances1[0]);
      });

      // All instances in second group should be identical
      instances2.forEach((instance) => {
        expect(instance).toBe(instances2[0]);
      });

      // But groups should be different
      expect(instances1[0]).not.toBe(instances2[0]);
    });
  });
});
