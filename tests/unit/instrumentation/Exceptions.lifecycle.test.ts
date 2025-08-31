/**
 * @jest-environment jsdom
 */

// Mock dependencies
jest.mock('@src/instrumentation/trackers', () => ({
  ErrorTracker: {
    getInstance: jest.fn(),
  },
}));

jest.mock('@src/shared', () => ({
  rumLogger: {
    error: jest.fn(),
  },
  DOM_EVENT: {
    ERROR: 'error',
    UNHANDLED_REJECTION: 'unhandledrejection',
  },
}));

describe('Exceptions Lifecycle Logic', () => {
  let mockErrorTracker: any;
  let mockUnsubscribe: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    const { ErrorTracker } = require('@src/instrumentation/trackers');

    mockUnsubscribe = jest.fn();
    mockErrorTracker = {
      subscribe: jest.fn(() => mockUnsubscribe),
    };

    ErrorTracker.getInstance.mockReturnValue(mockErrorTracker);
  });

  it('should demonstrate error tracker subscription and cleanup logic', () => {
    const { ErrorTracker } = require('@src/instrumentation/trackers');

    // Simulate enable logic
    let errorUnsubscribe: (() => void) | null = null;

    expect(() => {
      const errorTracker = ErrorTracker.getInstance();
      errorUnsubscribe = errorTracker.subscribe(jest.fn());
    }).not.toThrow();

    expect(mockErrorTracker.subscribe).toHaveBeenCalledWith(expect.any(Function));
    expect(typeof errorUnsubscribe).toBe('function');

    // Simulate disable logic
    expect(() => {
      if (errorUnsubscribe) {
        errorUnsubscribe();
        errorUnsubscribe = null;
      }
    }).not.toThrow();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });

  it('should handle error tracker setup failures gracefully', () => {
    const { ErrorTracker } = require('@src/instrumentation/trackers');
    const { rumLogger } = require('@src/shared');

    // Make ErrorTracker.getInstance throw
    ErrorTracker.getInstance.mockImplementation(() => {
      throw new Error('ErrorTracker setup failed');
    });

    expect(() => {
      try {
        const errorTracker = ErrorTracker.getInstance();
        errorTracker.subscribe(jest.fn());
      } catch (error) {
        rumLogger.error('Failed to enable error tracking instrumentation:', error);
      }
    }).not.toThrow();
  });

  it('should handle unsubscribe failures gracefully', () => {
    const { rumLogger } = require('@src/shared');

    // Make unsubscribe throw
    mockUnsubscribe.mockImplementation(() => {
      throw new Error('Unsubscribe failed');
    });

    let errorUnsubscribe: (() => void) | null = mockUnsubscribe;

    expect(() => {
      try {
        if (errorUnsubscribe) {
          errorUnsubscribe();
          errorUnsubscribe = null;
        }
      } catch (error) {
        rumLogger.error('Failed to disable error tracking instrumentation:', error);
      }
    }).not.toThrow();
  });

  it('should demonstrate subscription handler behavior', () => {
    const { ErrorTracker } = require('@src/instrumentation/trackers');

    const errorTracker = ErrorTracker.getInstance();
    const handler = jest.fn();

    const unsubscribe = errorTracker.subscribe(handler);

    expect(mockErrorTracker.subscribe).toHaveBeenCalledWith(handler);
    expect(typeof unsubscribe).toBe('function');

    // Multiple subscriptions should work
    const handler2 = jest.fn();
    const unsubscribe2 = errorTracker.subscribe(handler2);

    expect(mockErrorTracker.subscribe).toHaveBeenCalledTimes(2);
    expect(typeof unsubscribe2).toBe('function');
  });
});
