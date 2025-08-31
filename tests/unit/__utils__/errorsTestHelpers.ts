import { DOM_EVENT } from '@src/shared/constants';
import type { ErrorEventData } from '@src/instrumentation/trackers/Errors';
import { createRumLoggerMock } from './loggerMocks';
import { TEST_ERRORS, TEST_TIMESTAMPS } from './testConstants';

/**
 * Complete mock setup for ErrorTracker tests
 * Use this as jest.mock() parameter to get consistent mocking
 */
export const createErrorsSharedMocks = () => {
  const mockData = {
    // Import actual constants instead of mocking them
    ...jest.requireActual('@src/shared'),
    // Override only behavioral exports
    rumLogger: createRumLoggerMock(),
    EventListener: jest.fn().mockImplementation(() => ({
      set: jest.fn(),
      remove: jest.fn(),
    })),
  };

  return mockData;
};

// Legacy export for backward compatibility
export const errorsSharedMocks = createErrorsSharedMocks();

// Common test data factories using shared constants
export const createMockError = (overrides: Partial<ErrorEventData> = {}): ErrorEventData =>
  ({
    message: TEST_ERRORS.MESSAGE,
    filename: TEST_ERRORS.FILENAME,
    line: TEST_ERRORS.LINE,
    column: TEST_ERRORS.COLUMN,
    stack: TEST_ERRORS.STACK,
    timestamp: TEST_TIMESTAMPS.BASE,
    kind: DOM_EVENT.ERROR,
    ...overrides,
  }) as ErrorEventData;

export const createMockUnhandledRejection = (
  overrides: Partial<ErrorEventData> = {},
): ErrorEventData =>
  ({
    message: 'Unhandled promise rejection',
    filename: 'promise.js',
    line: 15,
    column: 5,
    stack: 'Promise rejection stack',
    timestamp: TEST_TIMESTAMPS.BASE,
    kind: DOM_EVENT.UNHANDLED_REJECTION,
    ...overrides,
  }) as ErrorEventData;

// Test scenarios for table-driven tests
export const errorScenarios = [
  {
    name: 'basic error event',
    eventType: 'error',
    eventData: { message: 'Basic error', filename: 'basic.js', lineno: 1, colno: 1 },
  },
  {
    name: 'unhandled rejection',
    eventType: 'unhandledrejection',
    eventData: { message: 'Promise rejected', filename: 'promise.js', lineno: 10, colno: 5 },
  },
];

// Setup helper for ErrorTracker tests
export function setupErrorsTest() {
  // Clear all mocks
  jest.clearAllMocks();

  // Setup fake timers
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2023-01-01T00:00:00.000Z'));

  // Reset ErrorTracker singleton
  const { ErrorTracker } = require('@src/instrumentation/trackers/Errors');
  if (ErrorTracker.instance) {
    ErrorTracker.instance.shutdown();
    (ErrorTracker as any).instance = null;
  }

  return {
    ErrorTracker,
    cleanup: () => {
      jest.useRealTimers();
      if (ErrorTracker.instance) {
        ErrorTracker.instance.shutdown();
        (ErrorTracker as any).instance = null;
      }
    },
  };
}

// Helper to dispatch error events by calling the registered handler directly
export function dispatchErrorEvent(eventData: Partial<ErrorEventData> = {}) {
  const { EventListener } = require('@src/shared');

  // Find the error event handler that was registered
  const errorHandlerCall = EventListener.mock.calls.find(
    (call: any) => call && call.length > 2 && call[1] === 'error',
  );

  if (errorHandlerCall && errorHandlerCall[2]) {
    const errorHandler = errorHandlerCall[2];

    // Create a mock ErrorEvent-like object
    const mockErrorEvent = {
      message: eventData.message || 'Test error',
      filename: eventData.filename || 'test.js',
      lineno: eventData.line || 1,
      colno: eventData.column || 1,
      error: new Error(eventData.message || 'Test error'),
    };

    // Call the handler directly
    errorHandler(mockErrorEvent);
    return mockErrorEvent;
  }

  return null;
}

// Helper to dispatch unhandled rejection events by calling the registered handler directly
export function dispatchUnhandledRejectionEvent(reason: any = 'Test rejection') {
  const { EventListener } = require('@src/shared');

  // Find the unhandledrejection event handler that was registered
  const rejectionHandlerCall = EventListener.mock.calls.find(
    (call: any) => call && call.length > 2 && call[1] === 'unhandledrejection',
  );

  if (rejectionHandlerCall && rejectionHandlerCall[2]) {
    const rejectionHandler = rejectionHandlerCall[2];

    // Create a mock PromiseRejectionEvent-like object
    const mockRejectionEvent = {
      reason: reason,
    };

    // Call the handler directly
    rejectionHandler(mockRejectionEvent);
    return mockRejectionEvent;
  }

  return null;
}
