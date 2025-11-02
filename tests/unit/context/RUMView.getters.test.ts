import { createGenerateIdOnlyMock } from '../__utils__/utilsMocks';

// Mocks before imports
jest.mock('@opentelemetry/api-logs', () => ({
  logs: {
    getLogger: jest.fn(() => ({ emit: jest.fn() })),
  },
}));

// Use centralized utils mock
jest.mock('@src/utils', () => createGenerateIdOnlyMock('view-xyz'));

// Mock the context manager
jest.mock('@src/context/LogzioContextManager', () => ({
  rumContextManager: {
    setViewContext: jest.fn(),
  },
}));

jest.mock('@src/aggregations/WebVitalsAggregator', () => ({
  WebVitalsAggregator: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    flushMetrics: jest.fn(),
  })),
}));

jest.mock('@src/openTelemetry/setup', () => ({
  OpenTelemetryProvider: {
    getInstance: jest.fn(() => ({
      getMeterProvider: jest.fn(() => ({})),
    })),
  },
}));

import { RUMView } from '@src/context/RUMView';

describe('RUMView getters and timing', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(10_000);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const cfg = {
    tokens: { metrics: 'test-metrics-token' },
    enable: { webVitals: false, viewEvents: false },
  } as any;

  it('should return generated id in getViewId', () => {
    const view = new RUMView('s', cfg);
    expect(view.getViewId()).toBe('view-xyz');
  });

  it('should return current window location at construction time in getUrl', () => {
    const view = new RUMView('s', cfg);
    expect(view.getUrl()).toBe(window.location.href);
  });

  it('should be 0 before start in getDuration', () => {
    const view = new RUMView('s', cfg);
    expect(view.getDuration()).toBe(0);
  });

  it('should reflect elapsed time after start in getDuration', () => {
    const view = new RUMView('s', cfg);
    view.start(); // t = 10000
    jest.advanceTimersByTime(750); // t = 10750
    expect(view.getDuration()).toBe(750);
  });
});
