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
  ATTR_URL: 'url.path',
}));

// Mock OTel API using centralized helper
import { createOtelApiMock } from '../__utils__/otelApiMocks';
const histogramRecordMock = jest.fn();
const createHistogramMock = jest.fn(() => ({ record: histogramRecordMock }));
const getMeterMock = jest.fn(() => ({ createHistogram: createHistogramMock }));

jest.mock('@opentelemetry/api', () => ({
  ...createOtelApiMock(),
  metrics: {
    getMeter: () => getMeterMock(),
  },
}));

import { WebVitalsAggregator } from '@src/aggregations/WebVitalsAggregator';

class MockMeterProvider {
  public forceFlush = jest.fn();
}

describe('WebVitalsAggregator - processing and flush', () => {
  beforeEach(() => {
    fcpCb = lcpCb = ttfbCb = clsCb = inpCb = undefined;
    histogramRecordMock.mockClear();
    createHistogramMock.mockClear();
    getMeterMock.mockClear();
  });

  it('should record FCP with correct histogram name and unit ms', () => {
    const agg = new WebVitalsAggregator();
    agg.start();

    fcpCb?.({ name: 'FCP', value: 123, attribution: {} });

    agg.flushMetrics();

    expect(getMeterMock).toHaveBeenCalled();
    expect(createHistogramMock).toHaveBeenCalledWith(
      'web.vitals.fcp',
      expect.objectContaining({ unit: 'ms' }),
    );
    expect(histogramRecordMock).toHaveBeenCalledWith(
      123,
      expect.objectContaining({ 'url.path': expect.any(String), 'navigation.type': 'unknown' }),
    );
  });

  it('should handle CLS unit as unitless', () => {
    const agg = new WebVitalsAggregator();
    agg.start();
    clsCb?.({ name: 'CLS', value: 0.02, attribution: {} });
    agg.flushMetrics();
    expect(createHistogramMock).toHaveBeenCalledWith(
      'web.vitals.cls',
      expect.objectContaining({ unit: 'unitless' }),
    );
  });

  it('should include URL and default navigation.type in attributes', () => {
    const agg = new WebVitalsAggregator();
    agg.start();
    lcpCb?.({ name: 'LCP', value: 2500, attribution: {} });
    agg.flushMetrics();
    expect(histogramRecordMock).toHaveBeenCalledWith(
      2500,
      expect.objectContaining({ 'url.path': expect.any(String), 'navigation.type': 'unknown' }),
    );
  });

  it('should include representative keys for each metric in attribution mapping', () => {
    const agg = new WebVitalsAggregator();
    agg.start();

    clsCb?.({
      name: 'CLS',
      value: 1,
      attribution: {
        largestShiftTarget: 'div',
        largestShiftTime: 1,
        largestShiftValue: 0.1,
        largestShiftEntry: {},
        largestShiftSource: {},
        loadState: 'loaded',
      },
    });
    fcpCb?.({
      name: 'FCP',
      value: 2,
      attribution: {
        timeToFirstByte: 1,
        firstByteToFCP: 1,
        loadState: 'loaded',
        fcpEntry: {},
        navigationEntry: {},
      },
    });
    lcpCb?.({
      name: 'LCP',
      value: 3,
      attribution: {
        target: 'img',
        url: 'https://asset',
        timeToFirstByte: 1,
        resourceLoadDelay: 2,
        resourceLoadDuration: 3,
        elementRenderDelay: 4,
        navigationEntry: {},
        lcpEntry: {},
      },
    });
    ttfbCb?.({
      name: 'TTFB',
      value: 4,
      attribution: {
        waitingDuration: 1,
        cacheDuration: 2,
        dnsDuration: 3,
        connectionDuration: 4,
        requestDuration: 5,
        navigationEntry: {},
      },
    });
    inpCb?.({
      name: 'INP',
      value: 5,
      attribution: {
        interactionTarget: 'button',
        interactionTime: 10,
        interactionType: 'click',
        nextPaintTime: 12,
        processedEventEntries: [],
        inputDelay: 1,
        processingDuration: 2,
        presentationDelay: 3,
        loadState: 'loaded',
        longAnimationFrameEntries: [],
        longestScript: 4,
        totalScriptDuration: 5,
        totalStyleAndLayoutDuration: 6,
        totalPaintDuration: 7,
        totalUnattributedDuration: 8,
      },
    });

    agg.flushMetrics();

    const calls = histogramRecordMock.mock.calls.map(([, attrs]) => attrs);
    // Spot-check representative keys per metric
    expect(calls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ 'largest.shift.target': 'div', 'load.state': 'loaded' }),
        expect.objectContaining({
          'time.to.first.byte': 1,
          'first.contentful.paint.entry': expect.any(Object),
        }),
        expect.objectContaining({
          'largest.contentful.paint.target': 'img',
          'largest.contentful.paint.url': 'https://asset',
        }),
        expect.objectContaining({ 'waiting.duration': 1, 'connection.duration': 4 }),
        expect.objectContaining({ 'interaction.target': 'button', 'processing.duration': 2 }),
      ]),
    );
  });

  it('should handle no metrics -> flush as a no-op besides cleanup', () => {
    const agg = new WebVitalsAggregator();
    agg.start();
    agg.flushMetrics();
    expect(createHistogramMock).not.toHaveBeenCalled();
    expect(histogramRecordMock).not.toHaveBeenCalled();
    expect(Object.keys(agg.getCollectedMetrics())).toHaveLength(0);
  });

  it('should handle multiple metrics recorded -> all flushed', () => {
    const agg = new WebVitalsAggregator();
    agg.start();
    fcpCb?.({ name: 'FCP', value: 11, attribution: {} });
    lcpCb?.({ name: 'LCP', value: 22, attribution: {} });
    agg.flushMetrics();
    // Two record calls
    expect(histogramRecordMock.mock.calls.length).toBe(2);
  });

  it('should call meterProvider.forceFlush when provided', () => {
    const provider = new MockMeterProvider();
    const agg = new WebVitalsAggregator(provider as any);
    agg.start();
    ttfbCb?.({ name: 'TTFB', value: 77, attribution: {} });
    agg.flushMetrics();
    expect(provider.forceFlush).toHaveBeenCalledTimes(1);
  });
});
