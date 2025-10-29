import { getTraceProvider } from '../../../../src/openTelemetry/providers/traces';
import {
  setupTracesTest,
  mockConstructCalls,
  createMockResource,
  createMockConfig,
  exporterInstances,
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
  AlwaysOnSampler: class MockAlwaysOnSampler {
    __type = 'AlwaysOnSampler';
  },
  AlwaysOffSampler: class MockAlwaysOffSampler {
    __type = 'AlwaysOffSampler';
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
    ratio: number | undefined;
    constructor(config: { root: any }) {
      this.root = config.root;
      // Return the root sampler's type for easier testing
      this.__type = config.root.__type;
      if (config.root.ratio !== undefined) {
        this.ratio = config.root.ratio;
      }
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

describe('Traces Provider - Basic Functionality', () => {
  beforeEach(() => {
    setupTracesTest();
  });

  it('should create WebTracerProvider with resource, sampler and spanProcessors', () => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const endpoint = 'https://traces.example.com';
    const config = createMockConfig();

    const provider = getTraceProvider(resource, endpoint, config);

    // Verify WebTracerProvider was created
    expect(provider).toBeDefined();
    const tracerCall = mockConstructCalls.find(([name]) => name === 'WebTracerProvider');
    expect(tracerCall).toBeTruthy();

    // Verify options
    const options = tracerCall[1];
    expect(options.resource).toBe(resource);
    expect(options.sampler).toBeDefined();
    expect(Array.isArray(options.spanProcessors)).toBe(true);
  });

  it('should return WebTracerProvider instance', () => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const endpoint = 'https://traces.example.com';
    const config = createMockConfig();

    const provider = getTraceProvider(resource, endpoint, config);

    // Should return the mocked WebTracerProvider instance
    expect(provider).toBeDefined();
    expect(provider.constructor.name).toBe('MockWebTracerProvider');
  });

  it('should handle undefined enable config gracefully', () => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const endpoint = 'https://traces.example.com';
    const config = createMockConfig({ enable: undefined });

    expect(() => getTraceProvider(resource, endpoint, config)).not.toThrow();

    const tracerCall = mockConstructCalls.find(([name]) => name === 'WebTracerProvider');
    const processors = tracerCall[1].spanProcessors;

    // Should only have SessionContextSpanProcessor and BatchSpanProcessor
    expect(processors).toHaveLength(2);
    expect(processors[0].__type).toBe('SessionContextSpanProcessor');
    expect(processors[1].constructor.name).toBe('MockBatchSpanProcessor');
  });

  it('should handle missing frustrationDetection property gracefully', () => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const endpoint = 'https://traces.example.com';
    const config = createMockConfig({ enable: {} });

    expect(() => getTraceProvider(resource, endpoint, config)).not.toThrow();

    const tracerCall = mockConstructCalls.find(([name]) => name === 'WebTracerProvider');
    const processors = tracerCall[1].spanProcessors;

    // Should only have SessionContextSpanProcessor and BatchSpanProcessor (no frustration detection)
    expect(processors).toHaveLength(2);
    expect(processors[0].__type).toBe('SessionContextSpanProcessor');
    expect(processors[1].constructor.name).toBe('MockBatchSpanProcessor');
  });

  it('should integrate all components correctly', () => {
    const resource = createMockResource({ serviceName: 'integration-test' });
    const endpoint = 'https://traces.logz.io/v1/traces';
    const config = createMockConfig({
      samplingRate: 75,
      enable: { frustrationDetection: true },
    });

    const provider = getTraceProvider(resource, endpoint, config);

    // Verify all expected components were created
    expect(provider).toBeDefined();

    const tracerCall = mockConstructCalls.find(([name]) => name === 'WebTracerProvider');
    const exporterCall = mockConstructCalls.find(([name]) => name === 'OTLPTraceExporter');
    const batchProcessorCall = mockConstructCalls.find(([name]) => name === 'BatchSpanProcessor');
    const sessionProcessorCall = mockConstructCalls.find(
      ([name]) => name === 'SessionContextSpanProcessor',
    );
    const frustrationProcessorCall = mockConstructCalls.find(
      ([name]) => name === 'FrustrationDetectionProcessor',
    );

    expect(tracerCall).toBeTruthy();
    expect(exporterCall).toBeTruthy();
    expect(batchProcessorCall).toBeTruthy();
    expect(sessionProcessorCall).toBeTruthy();
    expect(frustrationProcessorCall).toBeTruthy();

    // Verify all components are wired correctly
    const options = tracerCall[1];
    expect(options.resource).toBe(resource);
    expect(options.sampler.__type).toBe('TraceIdRatioBasedSampler');
    expect(options.sampler.ratio).toBe(0.75);
    expect(options.spanProcessors).toHaveLength(3);
  });
});
