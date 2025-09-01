import { AUTHORIZATION_HEADER, LOGZIO_REGION_HEADER } from '@src/openTelemetry/providers/constants';
import { getTraceProvider } from '../../../../src/openTelemetry/providers/traces';
import {
  setupTracesTest,
  mockConstructCalls,
  exporterInstances,
  createMockResource,
  createMockConfig,
} from '../../__utils__/tracesTestHelpers';

// Mock processors
jest.mock('@src/openTelemetry/processors', () => ({
  SessionContextSpanProcessor: class MockSessionContextSpanProcessor {
    __type = 'SessionContextSpanProcessor';
    constructor() {
      mockConstructCalls.push(['SessionContextSpanProcessor']);
    }
  },
  FrustrationDetectionProcessor: class MockFrustrationDetectionProcessor {
    __type = 'FrustrationDetectionProcessor';
    constructor(config: any) {
      mockConstructCalls.push(['FrustrationDetectionProcessor', config]);
    }
  },
}));

// Apply mocks
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

jest.mock('@opentelemetry/sdk-trace-web', () => ({
  WebTracerProvider: class MockWebTracerProvider {
    options: any;
    constructor(options: any) {
      this.options = options;
      mockConstructCalls.push(['WebTracerProvider', options]);
    }
  },
  BatchSpanProcessor: class MockBatchSpanProcessor {
    exporter: any;
    config: any;
    constructor(exporter: any, config: any) {
      this.exporter = exporter;
      this.config = config;
      mockConstructCalls.push(['BatchSpanProcessor', exporter, config]);
    }
  },
  TraceIdRatioBasedSampler: class MockTraceIdRatioBasedSampler {
    __type = 'TraceIdRatioBasedSampler';
    ratio: number;
    constructor(ratio: number) {
      this.ratio = ratio;
    }
  },
  ParentBasedSampler: class MockParentBasedSampler {
    __type = 'ParentBasedSampler';
    root: any;
    constructor(config: { root: any }) {
      this.root = config.root;
    }
  },
}));

jest.mock('@opentelemetry/exporter-trace-otlp-proto', () => ({
  OTLPTraceExporter: class MockOTLPTraceExporter {
    config: any;
    constructor(config: any) {
      this.config = config;
      mockConstructCalls.push(['OTLPTraceExporter', config]);
      exporterInstances.push(this);
    }
  },
}));

describe('Traces Provider - Exporter Configuration', () => {
  beforeEach(() => {
    setupTracesTest();
  });

  it('should create OTLPTraceExporter with correct endpoint and headers', () => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const endpoint = 'https://traces.example.com/v1/traces';
    const config = createMockConfig();

    getTraceProvider(resource, endpoint, config);

    const exporterCall = mockConstructCalls.find(([name]) => name === 'OTLPTraceExporter');
    expect(exporterCall).toBeTruthy();

    const [, options] = exporterCall;
    expect(options.url).toBe(endpoint);
    expect(options.headers).toEqual({
      [LOGZIO_REGION_HEADER]: config.region,
      [AUTHORIZATION_HEADER]: `Bearer ${config.tokens.traces}`,
    });
  });

  it('should wire exporter to BatchSpanProcessor correctly', () => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const endpoint = 'https://traces.example.com';
    const config = createMockConfig();

    getTraceProvider(resource, endpoint, config);

    const exporterCall = mockConstructCalls.find(([name]) => name === 'OTLPTraceExporter');
    const batchProcessorCall = mockConstructCalls.find(([name]) => name === 'BatchSpanProcessor');

    expect(exporterCall).toBeTruthy();
    expect(batchProcessorCall).toBeTruthy();

    // The exporter instance should be passed to the BatchSpanProcessor
    const exporterInstance = exporterInstances[0];
    const [, passedExporter] = batchProcessorCall;
    expect(passedExporter).toBe(exporterInstance);
  });

  it.each([
    'https://traces.logz.io/v1/traces',
    'http://localhost:4318/v1/traces',
    'https://api.example.com/telemetry/traces?token=abc123',
  ])('should pass endpoint URL %s through to exporter without modification', (endpoint) => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const config = createMockConfig();

    getTraceProvider(resource, endpoint, config);

    const exporterCall = mockConstructCalls.find(([name]) => name === 'OTLPTraceExporter');
    expect(exporterCall[1].url).toBe(endpoint);
  });

  it.each([
    '',
    'https://example.com',
    'https://example.com/',
    'https://example.com/traces',
    'https://example.com/traces?query=param',
    'http://localhost:4318',
    'http://localhost:4318/v1/traces',
  ])('should not throw with endpoint format: %s', (endpoint) => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const config = createMockConfig();

    expect(() => getTraceProvider(resource, endpoint, config)).not.toThrow();
  });

  it('should create single exporter instance per provider call', () => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const endpoint = 'https://traces.example.com';
    const config = createMockConfig();

    getTraceProvider(resource, endpoint, config);

    expect(exporterInstances).toHaveLength(1);

    const exporterCalls = mockConstructCalls.filter(([name]) => name === 'OTLPTraceExporter');
    expect(exporterCalls).toHaveLength(1);
  });

  it('should create new exporter for each provider call', () => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const endpoint = 'https://traces.example.com';
    const config = createMockConfig();

    // First call
    getTraceProvider(resource, endpoint, config);
    expect(exporterInstances).toHaveLength(1);
    const firstExporter = exporterInstances[0];

    // Second call (without clearing state)
    mockConstructCalls.length = 0; // Only clear calls, not instances
    getTraceProvider(resource, endpoint, config);

    expect(exporterInstances).toHaveLength(2);
    const secondExporter = exporterInstances[1];
    expect(secondExporter).not.toBe(firstExporter);
  });
});
