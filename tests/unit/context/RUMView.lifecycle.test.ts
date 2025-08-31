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

jest.mock('@src/instrumentation', () => {
  const PageViewInstrumentation = jest.fn().mockImplementation(() => ({
    startPageViewSpans: jest.fn(),
    endPageViewSpan: jest.fn(),
  }));
  return {
    PageViewInstrumentation,
    ATTR_URL: 'url.path',
  };
});

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
    enable: { webVitals: true, viewEvents: true },
    ...(overrides || {}),
  });

  it('should initialize page view spans and metric aggregation in start() and flush and finish in end()', () => {
    const config = createConfig();
    const view = new RUMView('sess-1', config as any);

    // Act: start → advance time → end
    view.start();
    jest.advanceTimersByTime(2_000);
    view.end();

    const { PageViewInstrumentation } = require('@src/instrumentation');
    const pageViewInstance = (PageViewInstrumentation as jest.Mock).mock.results[0].value;
    expect(pageViewInstance.startPageViewSpans).toHaveBeenCalledWith('sess-1', 'view-123');
    expect(pageViewInstance.endPageViewSpan).toHaveBeenCalled();

    const { WebVitalsAggregator } = require('@src/aggregations/WebVitalsAggregator');
    const aggregatorInstance = (WebVitalsAggregator as jest.Mock).mock.results[0].value;
    expect(WebVitalsAggregator).toHaveBeenCalled();
    expect(aggregatorInstance.start).toHaveBeenCalled();
    expect(aggregatorInstance.flushMetrics).toHaveBeenCalled();
  });

  it('should emit view_end event with expected attributes when viewEvents enabled', () => {
    const config = createConfig();
    const view = new RUMView('sess-9', config as any);

    view.start();
    jest.advanceTimersByTime(500);
    view.end();

    const emitMock = (logs.getLogger as jest.Mock).mock.results[0].value.emit as jest.Mock;
    expect(emitMock).toHaveBeenCalledTimes(1);

    const event = emitMock.mock.calls[0][0];
    expect(event.severityText).toBe('INFO');
    expect(typeof event.body).toBe('string');
    expect(event.attributes['url.path']).toBe(window.location.href);
    expect(typeof event.attributes.duration).toBe('number');
    expect(event.attributes['event.type']).toBe('view_end');
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
    expect(emitMock).toHaveBeenCalledTimes(1);
  });

  it('should emit with zero duration when viewEvents enabled in end() before start()', () => {
    const config = createConfig({ enable: { webVitals: false, viewEvents: true } });
    const view = new RUMView('s', config as any);

    view.end();

    const emitMock = (logs.getLogger as jest.Mock).mock.results[0].value.emit as jest.Mock;
    const event = emitMock.mock.calls[0][0];
    expect(event.attributes.duration).toBe(0);
    expect(event.attributes.startTime).toBeNull();
  });
});
