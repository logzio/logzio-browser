import { MAX_METRIC_WAIT_MS } from '@src/openTelemetry/providers/constants';
import { ATTR_SESSION_ID, ATTR_VIEW_ID } from '@src/instrumentation';

// Track constructor calls
const mockConstructCalls: any[] = [];
const exporterInstances: any[] = [];

// Mock @opentelemetry/resources
jest.mock('@opentelemetry/resources', () => ({
  Resource: class MockResource {
    attributes: any;
    constructor(attributes: any = {}) {
      this.attributes = attributes;
    }
    merge() {
      return this;
    }
    getRawAttributes() {
      return this.attributes;
    }
  },
}));

// Mock @opentelemetry/sdk-metrics
jest.mock('@opentelemetry/sdk-metrics', () => ({
  PeriodicExportingMetricReader: class MockPeriodicExportingMetricReader {
    constructor(options: any) {
      mockConstructCalls.push(['PeriodicExportingMetricReader', options]);
    }
  },
  MeterProvider: class MockMeterProvider {
    constructor(options: any) {
      mockConstructCalls.push(['MeterProvider', options]);
    }
  },
}));

// Mock OTLPMetricExporter
jest.mock('@opentelemetry/exporter-metrics-otlp-http', () => ({
  OTLPMetricExporter: class MockOTLPMetricExporter {
    constructor(options: any) {
      exporterInstances.push(this);
      mockConstructCalls.push(['OTLPMetricExporter', options]);
    }
  },
}));

// Mock rumContextManager
jest.mock('@src/context/LogzioContextManager', () => ({
  rumContextManager: {
    active: jest.fn(() => ({})),
    getSessionId: jest.fn(),
    getViewId: jest.fn(),
    getCustomAttributes: jest.fn(),
  },
}));

// SUT
const { Resource } = require('@opentelemetry/resources');
const { getMetricsProvider } = require('@src/openTelemetry/providers/metrics');

// Get reference to mocked rumContextManager
const { rumContextManager: mockRumContextManager } = require('@src/context/LogzioContextManager');

describe('metrics provider', () => {
  const createMockResource = (attributes: any = {}) => new Resource(attributes);

  beforeEach(() => {
    mockConstructCalls.length = 0;
    exporterInstances.length = 0;
    jest.clearAllMocks();
  });

  it('should create MeterProvider with resource, views and readers', () => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const endpoint = 'https://metrics.example.com';

    const provider = getMetricsProvider(resource, endpoint, {
      region: 'us',
      tokens: { metrics: 'm' },
    });

    expect(provider).toBeDefined();
    const meterCall = mockConstructCalls.find(([name]) => name === 'MeterProvider');
    expect(meterCall).toBeTruthy();

    const options = meterCall[1];
    expect(options.resource).toBe(resource);
    expect(Array.isArray(options.views)).toBe(true);
    expect(options.views).toHaveLength(1);
    expect(Array.isArray(options.readers)).toBe(true);
    expect(options.readers).toHaveLength(1);
  });

  it('should configure view with correct properties', () => {
    const resource = createMockResource();
    getMetricsProvider(resource, 'https://example.com', { region: 'us', tokens: { metrics: 'm' } });

    const meterCall = mockConstructCalls.find(([name]) => name === 'MeterProvider');
    const view = meterCall[1].views[0];

    expect(view.name).toBeUndefined();
    expect(view.description).toBeUndefined();
    expect(view.instrumentName).toBe('*');
    expect(typeof view.attributeProcessor).toBe('function');
  });

  it('should configure PeriodicExportingMetricReader with correct interval and exporter', () => {
    const resource = createMockResource();
    getMetricsProvider(resource, 'https://example.com', { region: 'us', tokens: { metrics: 'm' } });

    const readerCall = mockConstructCalls.find(
      ([name]) => name === 'PeriodicExportingMetricReader',
    );
    const exporterCall = mockConstructCalls.find(([name]) => name === 'OTLPMetricExporter');

    expect(readerCall).toBeTruthy();
    expect(exporterCall).toBeTruthy();

    const [, readerOptions] = readerCall;
    expect(readerOptions.exportIntervalMillis).toBe(MAX_METRIC_WAIT_MS);
    expect(readerOptions.exporter).toBe(exporterInstances[0]);
  });

  it('should create OTLPMetricExporter with correct endpoint', () => {
    const resource = createMockResource();
    const endpoint = 'https://metrics.logz.io/v1/metrics';

    getMetricsProvider(resource, endpoint, { region: 'us', tokens: { metrics: 'm' } });

    const exporterCall = mockConstructCalls.find(([name]) => name === 'OTLPMetricExporter');
    const [, options] = exporterCall;
    expect(options.url).toBe(endpoint);
    expect(options.headers).toEqual({ LOGZIO_REGION: 'us', LOGZIO_METRICS_TOKEN: 'm' });
  });

  describe('attributeProcessor', () => {
    let attributeProcessor: any;

    beforeEach(() => {
      mockRumContextManager.getSessionId.mockReturnValue('session-123');
      mockRumContextManager.getViewId.mockReturnValue('view-456');
      mockRumContextManager.getCustomAttributes.mockReturnValue({ 'user.id': 'user-789' });

      const resource = createMockResource();
      getMetricsProvider(resource, 'https://example.com', {
        region: 'us',
        tokens: { metrics: 'm' },
      });

      const meterCall = mockConstructCalls.find(([name]) => name === 'MeterProvider');
      attributeProcessor = meterCall[1].views[0].attributeProcessor;
    });

    it('should add session, view IDs and custom attributes when missing', () => {
      const attributes: Record<string, any> = {};
      const result = attributeProcessor(attributes);

      expect(result).toBe(attributes);
      expect(attributes[ATTR_SESSION_ID]).toBe('session-123');
      expect(attributes[ATTR_VIEW_ID]).toBe('view-456');
      expect(attributes['user.id']).toBe('user-789');
    });

    it('should not override existing attributes', () => {
      const attributes: Record<string, any> = {
        [ATTR_SESSION_ID]: 'existing-session',
        [ATTR_VIEW_ID]: 'existing-view',
        'user.id': 'existing-user',
      };

      attributeProcessor(attributes);

      expect(attributes[ATTR_SESSION_ID]).toBe('existing-session');
      expect(attributes[ATTR_VIEW_ID]).toBe('existing-view');
      expect(attributes['user.id']).toBe('existing-user');
    });

    it('should handle undefined context values gracefully', () => {
      mockRumContextManager.getSessionId.mockReturnValue(undefined);
      mockRumContextManager.getViewId.mockReturnValue(undefined);
      mockRumContextManager.getCustomAttributes.mockReturnValue(undefined);

      const attributes: Record<string, any> = {};

      expect(() => attributeProcessor(attributes)).not.toThrow();
      expect(attributes[ATTR_SESSION_ID]).toBeUndefined();
      expect(attributes[ATTR_VIEW_ID]).toBeUndefined();
    });
  });
});
