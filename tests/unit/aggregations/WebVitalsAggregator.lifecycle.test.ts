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

// Mock OTel metrics API
const histogramRecordMock = jest.fn();
const createHistogramMock = jest.fn(() => ({ record: histogramRecordMock }));
jest.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: jest.fn(() => ({ createHistogram: createHistogramMock })),
  },
}));

// Mock instrumentation constants to avoid pulling heavy modules
jest.mock('@src/instrumentation', () => ({
  ATTR_URL: 'logzio.url',
}));

import { WebVitalsAggregator } from '@src/aggregations/WebVitalsAggregator';

describe('WebVitalsAggregator - lifecycle', () => {
  beforeEach(() => {
    // reset captured callbacks and mocks
    fcpCb = lcpCb = ttfbCb = clsCb = inpCb = undefined;
    histogramRecordMock.mockClear();
    createHistogramMock.mockClear();
  });

  it('start should register all observers and reset state', () => {
    const agg = new WebVitalsAggregator(null, 'session-123', 'view-456');

    // First start registers callbacks
    agg.start();
    expect(typeof fcpCb).toBe('function');
    expect(typeof lcpCb).toBe('function');
    expect(typeof ttfbCb).toBe('function');
    expect(typeof clsCb).toBe('function');
    expect(typeof inpCb).toBe('function');

    // Add a metric and verify it is stored
    fcpCb?.({ name: 'FCP', value: 123, attribution: {} });
    expect(Object.keys(agg.getCollectedMetrics())).toHaveLength(1);

    // Second start should cleanup existing metrics and re-register
    agg.start();
    expect(Object.keys(agg.getCollectedMetrics())).toHaveLength(0);
    expect(typeof fcpCb).toBe('function');
  });

  it('stop should trigger cleanup (empties collected metrics)', () => {
    const agg = new WebVitalsAggregator(null, 'session-123', 'view-456');
    agg.start();
    clsCb?.({ name: 'CLS', value: 0.02, attribution: {} });

    expect(Object.keys(agg.getCollectedMetrics())).toHaveLength(1);
    agg.stop();
    expect(Object.keys(agg.getCollectedMetrics())).toHaveLength(0);
  });

  it('getCollectedMetrics should return a defensive copy', () => {
    const agg = new WebVitalsAggregator(null, 'session-123', 'view-456');
    agg.start();
    lcpCb?.({ name: 'LCP', value: 2500, attribution: {} });

    const copy1 = agg.getCollectedMetrics();
    expect(Object.keys(copy1)).toEqual(['LCP']);

    // Mutate returned copy should not affect internal state
    (copy1 as any)['X'] = {};
    const copy2 = agg.getCollectedMetrics();
    expect(Object.keys(copy2)).toEqual(['LCP']);
  });

  it('start should be idempotent (no-throw on repeated calls)', () => {
    const agg = new WebVitalsAggregator(null, 'session-123', 'view-456');
    expect(() => {
      agg.start();
      agg.start();
      agg.start();
    }).not.toThrow();
    expect(typeof fcpCb).toBe('function');
  });
});
