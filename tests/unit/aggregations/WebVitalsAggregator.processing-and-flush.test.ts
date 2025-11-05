// Capture web-vitals callbacks
let fcpCb: any;
let lcpCb: any;
let ttfbCb: any;
let clsCb: any;
let inpCb: any;

jest.mock('web-vitals/attribution', () => ({
  onFCP: (cb: any) => {
    fcpCb = cb;
  },
  onLCP: (cb: any) => {
    lcpCb = cb;
  },
  onTTFB: (cb: any) => {
    ttfbCb = cb;
  },
  onCLS: (cb: any) => {
    clsCb = cb;
  },
  onINP: (cb: any) => {
    inpCb = cb;
  },
}));

// Mock instrumentation constants
jest.mock('@src/instrumentation', () => ({
  ATTR_SESSION_ID: 'session.id',
  ATTR_VIEW_ID: 'view.id',
  ATTR_REQUEST_PATH: 'request.path',
  ATTR_WEB_VITAL_NAME: 'web_vital.name',
  ATTR_WEB_VITAL_VALUE: 'web_vital.value',
  ATTR_WEB_VITAL_RATING: 'web_vital.rating',
  ATTR_WEB_VITAL_ID: 'web_vital.id',
  ATTR_WEB_VITAL_NAVIGATION_TYPE: 'web_vital.navigation_type',
}));

// Mock OTel API using centralized helper
import { createOtelApiMock } from '../__utils__/otelApiMocks';
const logEmitMock = jest.fn();
const getLoggerMock = jest.fn(() => ({ emit: logEmitMock }));

jest.mock('@opentelemetry/api', () => createOtelApiMock());

jest.mock('@opentelemetry/api-logs', () => ({
  logs: {
    getLogger: () => getLoggerMock(),
  },
}));

import { WebVitalsAggregator } from '@src/aggregations/WebVitalsAggregator';

describe('WebVitalsAggregator - processing and flush', () => {
  beforeEach(() => {
    fcpCb = lcpCb = ttfbCb = clsCb = inpCb = undefined;
    logEmitMock.mockClear();
    getLoggerMock.mockClear();
  });

  it('should emit FCP as a log with correct attributes', () => {
    const agg = new WebVitalsAggregator('session-123', 'view-456');
    agg.start();

    fcpCb?.({ name: 'FCP', value: 123, id: 'v1-123', rating: 'good', attribution: {} });

    agg.flushWebVitals();

    expect(getLoggerMock).toHaveBeenCalled();
    expect(logEmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        severityText: 'INFO',
        attributes: expect.objectContaining({
          'web_vital.name': 'FCP',
          'web_vital.value': 123,
          'web_vital.rating': 'good',
          'web_vital.id': 'v1-123',
          'session.id': 'session-123',
          'view.id': 'view-456',
          'request.path': expect.any(String),
        }),
      }),
    );
  });

  it('should emit CLS as a log with correct attributes', () => {
    const agg = new WebVitalsAggregator('session-123', 'view-456');
    agg.start();
    clsCb?.({ name: 'CLS', value: 0.02, id: 'v1-cls', rating: 'good', attribution: {} });
    agg.flushWebVitals();
    expect(logEmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        severityText: 'INFO',
        attributes: expect.objectContaining({
          'web_vital.name': 'CLS',
          'web_vital.value': 0.02,
        }),
      }),
    );
  });

  it('should include request.path and session/view IDs in log attributes', () => {
    const agg = new WebVitalsAggregator('session-123', 'view-456');
    agg.start();
    lcpCb?.({
      name: 'LCP',
      value: 2500,
      id: 'v1-lcp',
      rating: 'needs-improvement',
      attribution: {},
    });
    agg.flushWebVitals();
    expect(logEmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: expect.objectContaining({
          'request.path': expect.any(String),
          'session.id': 'session-123',
          'view.id': 'view-456',
        }),
      }),
    );
  });

  it('should emit logs with extended attribution data for all metrics', () => {
    const agg = new WebVitalsAggregator('session-123', 'view-456');
    agg.start();

    clsCb?.({
      name: 'CLS',
      value: 1,
      id: 'v1-cls',
      rating: 'poor',
      attribution: {
        largestShiftTarget: 'div',
        largestShiftTime: 1,
        largestShiftValue: 0.1,
        largestShiftEntry: {
          hadRecentInput: false,
          sources: [{}],
        },
        largestShiftSource: {
          node: { tagName: 'DIV' },
        },
        loadState: 'loaded',
      },
    });
    fcpCb?.({
      name: 'FCP',
      value: 2,
      id: 'v1-fcp',
      rating: 'good',
      attribution: {
        timeToFirstByte: 1,
        firstByteToFCP: 1,
        loadState: 'loaded',
        fcpEntry: {
          entryType: 'paint',
        },
        navigationEntry: {
          type: 'navigate',
          redirectCount: 0,
        },
      },
    });
    lcpCb?.({
      name: 'LCP',
      value: 3,
      id: 'v1-lcp',
      rating: 'good',
      attribution: {
        target: 'img',
        url: 'https://asset',
        timeToFirstByte: 1,
        resourceLoadDelay: 2,
        resourceLoadDuration: 3,
        elementRenderDelay: 4,
        navigationEntry: {
          type: 'navigate',
          redirectCount: 1,
        },
        lcpEntry: {
          element: { tagName: 'IMG' },
          size: 5000,
        },
      },
    });
    ttfbCb?.({
      name: 'TTFB',
      value: 4,
      id: 'v1-ttfb',
      rating: 'good',
      attribution: {
        waitingDuration: 1,
        cacheDuration: 2,
        dnsDuration: 3,
        connectionDuration: 4,
        requestDuration: 5,
        navigationEntry: {
          type: 'navigate',
          redirectCount: 2,
        },
      },
    });
    inpCb?.({
      name: 'INP',
      value: 5,
      id: 'v1-inp',
      rating: 'good',
      attribution: {
        interactionTarget: 'button',
        interactionTime: 10,
        interactionType: 'click',
        nextPaintTime: 12,
        processedEventEntries: [{ name: 'click', duration: 50 }],
        inputDelay: 1,
        processingDuration: 2,
        presentationDelay: 3,
        loadState: 'loaded',
        longAnimationFrameEntries: [{ duration: 100, scripts: [{}, {}] }],
        longestScript: {
          entry: { invokerType: 'user-callback' },
          subpart: 'script-execution',
        },
        totalScriptDuration: 5,
        totalStyleAndLayoutDuration: 6,
        totalPaintDuration: 7,
        totalUnattributedDuration: 8,
      },
    });

    agg.flushWebVitals();

    // All 5 web vitals should be emitted as logs
    expect(logEmitMock).toHaveBeenCalledTimes(5);

    // Verify each log has the web_vital event type and includes attribution data
    const calls = logEmitMock.mock.calls;
    calls.forEach(([logRecord]) => {
      expect(logRecord.severityText).toBe('INFO');
      expect(logRecord.attributes['event_type']).toBe('web_vital');
      expect(logRecord.attributes['session.id']).toBe('session-123');
      expect(logRecord.attributes['view.id']).toBe('view-456');
      expect(logRecord.attributes['request.path']).toBeDefined();
    });
  });

  it('should handle no metrics -> flush as a no-op besides cleanup', () => {
    const agg = new WebVitalsAggregator('session-123', 'view-456');
    agg.start();
    agg.flushWebVitals();
    expect(logEmitMock).not.toHaveBeenCalled();
    expect(Object.keys(agg.getCollectedMetrics())).toHaveLength(0);
  });

  it('should handle multiple metrics recorded -> all flushed as logs', () => {
    const agg = new WebVitalsAggregator('session-123', 'view-456');
    agg.start();
    fcpCb?.({ name: 'FCP', value: 11, id: 'v1-fcp', rating: 'good', attribution: {} });
    lcpCb?.({ name: 'LCP', value: 22, id: 'v1-lcp', rating: 'good', attribution: {} });
    agg.flushWebVitals();
    // Two log emit calls
    expect(logEmitMock).toHaveBeenCalledTimes(2);
  });
});
