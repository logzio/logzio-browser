// Mocks must be declared before importing the module under test
jest.mock('@opentelemetry/api-logs', () => ({
  logs: {
    getLogger: jest.fn(() => ({
      emit: jest.fn(),
    })),
  },
}));

jest.mock('@opentelemetry/instrumentation-user-interaction', () => ({
  AttributeNames: { EVENT_TYPE: 'event.type' },
}));

jest.mock('@src/shared', () => ({
  LOGZIO_RUM_PROVIDER_NAME: 'logzio-rum',
  rumLogger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@src/utils', () => ({
  generateId: jest.fn(() => 'view-123'),
}));

// Mock the context manager
jest.mock('@src/context/LogzioContextManager', () => ({
  rumContextManager: {
    setViewContext: jest.fn(),
  },
}));

jest.mock('@src/aggregations/WebVitalsAggregator', () => ({
  WebVitalsAggregator: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    flushWebVitals: jest.fn(),
  })),
}));

jest.mock('@src/openTelemetry/setup', () => ({
  OpenTelemetryProvider: {
    getInstance: jest.fn(() => ({})),
  },
}));

import { logs } from '@opentelemetry/api-logs';
import { RUMView } from '@src/context/RUMView';

describe('RUMView lifecycle and events', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(1_000);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const createConfig = (overrides?: Partial<any>) => ({
    tokens: { metrics: 'test-metrics-token' },
    enable: { webVitals: true, viewEvents: true },
    ...(overrides || {}),
  });

  it('should apply view context and initialize metric aggregation in start() and flush in end()', () => {
    const config = createConfig();
    const view = new RUMView('sess-1', config as any);

    // Act: start → advance time → end
    view.start();
    jest.advanceTimersByTime(2_000);
    view.end();

    const { rumContextManager } = require('@src/context/LogzioContextManager');
    expect(rumContextManager.setViewContext).toHaveBeenCalledWith('sess-1', 'view-123');

    const { WebVitalsAggregator } = require('@src/aggregations/WebVitalsAggregator');
    const aggregatorInstance = (WebVitalsAggregator as jest.Mock).mock.results[0].value;
    expect(WebVitalsAggregator).toHaveBeenCalled();
    expect(aggregatorInstance.start).toHaveBeenCalled();
    expect(aggregatorInstance.flushWebVitals).toHaveBeenCalled();
  });

  it('should emit view_start and view_end events with expected attributes when viewEvents enabled', () => {
    const config = createConfig();
    const view = new RUMView('sess-9', config as any);

    view.start();
    jest.advanceTimersByTime(500);
    view.end();

    const emitMock = (logs.getLogger as jest.Mock).mock.results[0].value.emit as jest.Mock;
    expect(emitMock).toHaveBeenCalledTimes(2);

    // Check view_start event
    const startEvent = emitMock.mock.calls[0][0];
    expect(startEvent.severityText).toBe('INFO');
    expect(startEvent.attributes['url.path']).toBe(window.location.href);
    expect(startEvent.attributes['request.path']).toBe(new URL(window.location.href).pathname);
    expect(startEvent.attributes['event.type']).toBe('view_start');
    expect(startEvent.attributes['session.id']).toBe('sess-9');
    expect(typeof startEvent.attributes['view.id']).toBe('string');
    expect(typeof startEvent.attributes.startTime).toBe('number');

    // Check view_end event
    const endEvent = emitMock.mock.calls[1][0];
    expect(endEvent.severityText).toBe('INFO');
    expect(endEvent.attributes['url.path']).toBe(window.location.href);
    expect(endEvent.attributes['request.path']).toBe(new URL(window.location.href).pathname);
    expect(typeof endEvent.attributes.duration).toBe('number');
    expect(endEvent.attributes['event.type']).toBe('view_end');
    expect(endEvent.attributes['session.id']).toBe('sess-9');
    expect(typeof endEvent.attributes['view.id']).toBe('string');
    expect(typeof endEvent.attributes.startTime).toBe('number');
  });

  it('should not emit event when viewEvents disabled', () => {
    const config = createConfig({ enable: { webVitals: false, viewEvents: false } });
    const view = new RUMView('s', config as any);

    view.start();
    view.end();

    const emitMock = (logs.getLogger as jest.Mock).mock.results[0].value.emit as jest.Mock;
    expect(emitMock).not.toHaveBeenCalled();
  });

  it('should not initialize aggregator when webVitals disabled and still ends gracefully', () => {
    const config = createConfig({ enable: { webVitals: false, viewEvents: true } });
    const view = new RUMView('s', config as any);

    view.start();
    view.end();

    const { WebVitalsAggregator } = require('@src/aggregations/WebVitalsAggregator');
    expect(WebVitalsAggregator).not.toHaveBeenCalled();

    const emitMock = (logs.getLogger as jest.Mock).mock.results[0].value.emit as jest.Mock;
    expect(emitMock).toHaveBeenCalledTimes(2); // view_start and view_end
  });

  it('should not emit any events when end() is called before start()', () => {
    const config = createConfig({ enable: { webVitals: false, viewEvents: true } });
    const view = new RUMView('s', config as any);

    view.end();

    const emitMock = (logs.getLogger as jest.Mock).mock.results[0].value.emit as jest.Mock;
    expect(emitMock).not.toHaveBeenCalled();
  });

  it('should be idempotent - multiple end() calls should only emit one view_end event', () => {
    const config = createConfig({ enable: { webVitals: false, viewEvents: true } });
    const view = new RUMView('s', config as any);

    view.start();
    view.end();
    view.end(); // Second call should be ignored
    view.end(); // Third call should be ignored

    const emitMock = (logs.getLogger as jest.Mock).mock.results[0].value.emit as jest.Mock;
    expect(emitMock).toHaveBeenCalledTimes(2); // Only view_start and one view_end

    // Verify the events are correct
    const startEvent = emitMock.mock.calls[0][0];
    expect(startEvent.attributes['event.type']).toBe('view_start');

    const endEvent = emitMock.mock.calls[1][0];
    expect(endEvent.attributes['event.type']).toBe('view_end');
  });
});
