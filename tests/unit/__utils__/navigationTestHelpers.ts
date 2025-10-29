// Shared mock functions that can be reused across Navigation tests
export const mockEventListenerSet = jest.fn();
export const mockEventListenerRemove = jest.fn();
export const mockRumLoggerError = jest.fn();
export const mockRumLoggerWarn = jest.fn();
export const mockEventListenerConstructor = jest.fn().mockImplementation(() => ({
  set: mockEventListenerSet,
  remove: mockEventListenerRemove,
}));

/**
 * Standard mock configuration for Navigation tests
 * Use this object directly in jest.mock() calls for consistency
 */
export const createNavigationSharedMock = () => ({
  ...jest.requireActual('@src/shared'),
  rumLogger: {
    error: mockRumLoggerError,
    warn: mockRumLoggerWarn,
    debug: jest.fn(), // Add debug method
    info: jest.fn(), // Add info method for completeness
  },
  EventListener: mockEventListenerConstructor,
  DOM_EVENT: {
    POP_STATE: 'popstate',
    PUSH_STATE: 'pushState',
    REPLACE_STATE: 'replaceState',
    GO: 'go',
    BACK: 'back',
    FORWARD: 'forward',
  },
});

// Mock references that should be created in the test files themselves
export interface NavigationMocks {
  mockEventListenerSet: jest.Mock;
  mockEventListenerRemove: jest.Mock;
  mockRumLoggerError: jest.Mock;
  mockRumLoggerWarn: jest.Mock;
  mockEventListener: jest.Mock;
}

/**
 * Get references to mocked functions - call this after mocks are set up in test file
 */
export function getNavigationMocks(): NavigationMocks {
  const { rumLogger, EventListener } = require('@src/shared');
  return {
    mockEventListenerSet: EventListener().set,
    mockEventListenerRemove: EventListener().remove,
    mockRumLoggerError: rumLogger.error,
    mockRumLoggerWarn: rumLogger.warn,
    mockEventListener: EventListener,
  };
}

/**
 * Reset NavigationTracker singleton by clearing static instance
 * Note: This is a temporary solution until we can move to better module isolation
 */
export function resetNavigationTracker() {
  const { NavigationTracker } = require('@src/instrumentation/trackers/Navigation');
  if (NavigationTracker.instance) {
    NavigationTracker.instance = null;
  }
}

/**
 * Save original history methods before patching
 */
export function saveOriginalHistoryMethods() {
  return {
    pushState: window.history.pushState,
    replaceState: window.history.replaceState,
    go: window.history.go,
    back: window.history.back,
    forward: window.history.forward,
  };
}

/**
 * Restore original history methods
 */
export function restoreHistoryMethods(
  originalMethods: ReturnType<typeof saveOriginalHistoryMethods>,
) {
  Object.assign(window.history, originalMethods);
}

/**
 * Dispatch a popstate event manually
 */
export function dispatchPopstateEvent() {
  const event = new PopStateEvent('popstate', {
    state: null,
  });
  window.dispatchEvent(event);
}

/**
 * Create mock navigation event data
 */
export function createMockNavigationEvent(
  overrides: Partial<{
    oldUrl: string;
    newUrl: string;
    timestamp: number;
  }> = {},
) {
  return {
    oldUrl: 'http://localhost/old',
    newUrl: 'http://localhost/new',
    timestamp: Date.now(),
    ...overrides,
  };
}

/**
 * Common setup for navigation tests - call after mocks are set up
 */
export function setupNavigationTest() {
  // Use fake timers for consistent timestamps
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

  const mockTimestamp = 1234567890123;
  jest.spyOn(Date, 'now').mockReturnValue(mockTimestamp);

  // Save original history methods
  const originalHistoryMethods = saveOriginalHistoryMethods();

  // Reset singleton state
  resetNavigationTracker();

  // Get NavigationTracker class - should be imported normally in test file
  const { NavigationTracker } = require('@src/instrumentation/trackers/Navigation');

  // Reset URL to known state
  window.history.pushState({}, '', '/test-start');

  return {
    NavigationTracker,
    originalHistoryMethods,
    mockTimestamp,
    cleanup: () => {
      restoreHistoryMethods(originalHistoryMethods);
      jest.useRealTimers();
      jest.clearAllMocks();
    },
  };
}

/**
 * Table-driven test data for history API methods
 */
export const historyApiMethods = [
  {
    name: 'pushState',
    execute: (url: string) => window.history.pushState({}, '', url),
    expectsEvents: true,
  },
  {
    name: 'replaceState',
    execute: (url: string) => window.history.replaceState({}, '', url),
    expectsEvents: true,
  },
] as const;

/**
 * Table-driven test data for navigation scenarios
 */
export const navigationScenarios = [
  { path: '/simple-path', description: 'simple path' },
  { path: '/path/with/segments', description: 'path with segments' },
  { path: '/path?query=value', description: 'path with query' },
  { path: '/path#hash', description: 'path with hash' },
  { path: '/path?query=value#hash', description: 'path with query and hash' },
] as const;

/**
 * Helper to test that handlers receive identical event data
 */
export function expectIdenticalEventData(
  handlers: jest.Mock[],
  expectedShape: Record<string, any>,
) {
  // All handlers should be called
  handlers.forEach((handler) => {
    expect(handler).toHaveBeenCalledTimes(1);
  });

  // All should receive identical data
  const eventData = handlers.map((handler) => handler.mock.calls[0][0]);
  for (let i = 1; i < eventData.length; i++) {
    expect(eventData[0]).toEqual(eventData[i]);
  }

  // Data should match expected shape
  expect(eventData[0]).toEqual(expect.objectContaining(expectedShape));
}
