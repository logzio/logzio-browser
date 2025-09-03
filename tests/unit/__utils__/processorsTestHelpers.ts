/**
 * Centralized helpers and mocks for OpenTelemetry processors testing
 */
import { ATTR_SESSION_ID, ATTR_VIEW_ID } from '@src/instrumentation/semconv';

// Mock OpenTelemetry API
export const processorsSharedMocks = {
  '@opentelemetry/api': {
    logs: {
      getLogger: jest.fn(() => ({
        emit: jest.fn(),
      })),
    },
    metrics: {
      getMeter: jest.fn(() => ({
        createCounter: jest.fn(() => ({
          add: jest.fn(),
        })),
      })),
    },
  },
  ['@src/shared']: {
    rumLogger: {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
    },
  },
};

// Factory for creating mock spans
export const createMockSpan = (overrides: any = {}) => ({
  spanContext: () => ({
    traceId: 'test-trace-id',
    spanId: 'test-span-id',
    traceFlags: 1,
  }),
  attributes: {
    [ATTR_SESSION_ID]: 'test-session-id',
    [ATTR_VIEW_ID]: 'test-view-id',
    ...overrides.attributes,
  },
  duration: [1, 0], // 1 second
  startTime: [Math.floor(Date.now() / 1000), (Date.now() % 1000) * 1000000], // [seconds, nanoseconds]
  parentSpanId: 'parent-span-id',
  name: 'test-span', // Add span name
  setAttribute: jest.fn(),
  setAttributes: jest.fn(),
  ...overrides,
});

// Factory for creating mock log records
export const createMockLogRecord = (overrides: any = {}) => ({
  attributes: {
    [ATTR_SESSION_ID]: 'test-session-id',
    [ATTR_VIEW_ID]: 'test-view-id',
    ...overrides.attributes,
  },
  timestamp: Date.now(),
  severityText: 'INFO',
  body: 'Test log message',
  setAttribute: jest.fn(),
  setAttributes: jest.fn(),
  ...overrides,
});

// Common test scenarios
export const sessionContextScenarios = [
  {
    name: 'with session and view IDs',
    sessionId: 'session-123',
    viewId: 'view-456',
  },
  {
    name: 'with session ID only',
    sessionId: 'session-789',
    viewId: undefined,
  },
  {
    name: 'without context',
    sessionId: undefined,
    viewId: undefined,
  },
];

// Setup helper for processor tests
export function setupProcessorsTest() {
  jest.clearAllMocks();

  // Mock context manager
  const mockContextManager = {
    getSessionId: jest.fn(() => 'test-session-id'),
    getViewId: jest.fn(() => 'test-view-id'),
  };

  return {
    mockContextManager,
    cleanup: () => {
      jest.clearAllMocks();
    },
  };
}
