/**
 * Shared helpers for ErrorTracker testing
 */

/**
 * Reset ErrorTracker singleton by clearing static instance
 * (DO NOT clear module cache - it breaks mocks)
 */
export function resetErrorTracker() {
  const { ErrorTracker } = require('@src/instrumentation/trackers/Errors');
  if (ErrorTracker.instance) {
    ErrorTracker.instance = null;
  }
}

/**
 * Create a fresh ErrorTracker instance
 */
export function createErrorTracker() {
  resetErrorTracker();
  const { ErrorTracker } = require('@src/instrumentation/trackers/Errors');
  return ErrorTracker.getInstance();
}

/**
 * Create synthetic error event
 */
export function createMockErrorEvent(overrides: Partial<ErrorEvent> = {}): ErrorEvent {
  return {
    message: 'Test error message',
    filename: 'test.js',
    lineno: 10,
    colno: 5,
    error: new Error('Test error'),
    ...overrides,
  } as ErrorEvent;
}

/**
 * Create synthetic promise rejection event
 */
export function createMockRejectionEvent(reason: any = 'Test rejection'): PromiseRejectionEvent {
  const promise = Promise.reject(reason);
  // Prevent unhandled rejection error in tests
  promise.catch(() => {});

  return {
    reason,
    promise,
  } as unknown as PromiseRejectionEvent;
}
