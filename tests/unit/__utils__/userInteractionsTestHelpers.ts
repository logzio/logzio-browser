// Mock EventCounter
jest.mock('@src/utils/EventCounter', () => ({
  EventMonitor: jest.fn().mockImplementation(() => ({
    stop: jest.fn(() => ({ errors: 0, activities: 0 })),
  })),
}));

// Mock TimeBoundQueue
jest.mock('@src/utils/TimeBoundQueue', () => ({
  TimeBoundQueue: jest.fn().mockImplementation(() => ({
    push: jest.fn(),
    values: jest.fn(() => []),
  })),
}));

import { createOtelApiMock } from './otelApiMocks';

// Mock OpenTelemetry dependencies
jest.mock('@opentelemetry/api', () => createOtelApiMock());

jest.mock('@opentelemetry/sdk-trace-web', () => ({
  getElementXPath: jest.fn(() => '/html/body/button'),
}));

import { createSharedMock } from './loggerMocks';

// Mock shared dependencies
jest.mock('@src/shared', () => createSharedMock({ error: jest.fn(), warn: jest.fn() }));

// Mock navigation tracker
const mockNavigationTracker = {
  subscribe: jest.fn(() => jest.fn()), // Returns unsubscribe function
};

// Mock span
export const createMockSpan = (overrides: any = {}) => ({
  setAttribute: jest.fn(),
  end: jest.fn(),
  updateName: jest.fn(),
  spanContext: {
    name: 'click',
    ...overrides.spanContext,
  },
  ...overrides,
});

// Mock tracer
export const createMockTracer = (mockSpan: any) => ({
  startSpan: jest.fn(() => mockSpan),
});

// Mock HTML element
export const createMockElement = (overrides: any = {}) => ({
  tagName: 'BUTTON',
  getAttribute: jest.fn(),
  hasAttribute: jest.fn(() => false),
  ...overrides,
});

// Mock event
export const createMockEvent = (target: any) => ({
  target,
});

// Configuration factory
export const createUserInteractionsConfig = (overrides: any = {}) => ({
  eventNames: ['click'],
  frustrationThresholds: {
    rageClickCount: 3,
    rageClickIntervalMs: 1000,
  },
  navigationTracker: mockNavigationTracker,
  shouldPreventSpanCreation: jest.fn(() => false),
  ...overrides,
});

// Setup function for tests
export const setupUserInteractionsTest = () => {
  const mockSpan = createMockSpan();
  const mockTracer = createMockTracer(mockSpan);
  const mockElement = createMockElement();
  const mockEvent = createMockEvent(mockElement);

  // Clear all mocks
  jest.clearAllMocks();

  // Reset mock implementations
  const { EventMonitor } = require('@src/utils/EventCounter');
  EventMonitor.mockImplementation(() => ({
    stop: jest.fn(() => ({ errors: 0, activities: 0 })),
  }));

  const { TimeBoundQueue } = require('@src/utils/TimeBoundQueue');
  TimeBoundQueue.mockImplementation(() => ({
    push: jest.fn(),
    values: jest.fn(() => []),
  }));

  return {
    mockSpan,
    mockTracer,
    mockElement,
    mockEvent,
    mockNavigationTracker,
    EventMonitor,
    TimeBoundQueue,
  };
};

// Helper to test instrumentation logic without complex dependencies
export const testInstrumentationLogic = () => {
  // Test core logic functions without importing the actual class
  return {
    // Test rage click detection logic
    isRageClick: (
      clickHistory: any[],
      currentTime: number,
      targetElement: string,
      threshold: number,
      interval: number,
    ) => {
      const recentClicks = clickHistory.filter(
        (c) => currentTime - c.timestamp <= interval && c.targetElement === targetElement,
      );
      return recentClicks.length >= threshold;
    },

    // Test dead click detection logic
    isDeadClick: (activities: number) => activities === 0,

    // Test error click detection logic
    isErrorClick: (errors: number) => errors > 0,

    // Test span creation guard logic
    shouldCreateSpan: (element: any, eventName: string, instrumentedEvents: string[]) => {
      if (!(element && element.tagName)) return false;
      if (!element.getAttribute) return false;
      if (element.hasAttribute && element.hasAttribute('disabled')) return false;
      if (!instrumentedEvents.includes(eventName)) return false;
      return true;
    },

    // Test navigation update logic
    shouldUpdateSpanName: (oldUrl: string, newUrl: string, isEnabled: boolean) => {
      return oldUrl !== newUrl && isEnabled;
    },
  };
};
