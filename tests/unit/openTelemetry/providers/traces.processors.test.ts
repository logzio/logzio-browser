import { getTraceProvider } from '../../../../src/openTelemetry/providers/traces';
import { MAX_BULK_SIZE, MAX_SPAN_WAIT_MS } from '../../../../src/openTelemetry/providers/constants';
import {
  setupTracesTest,
  mockConstructCalls,
  createMockResource,
  createMockConfig,
  exporterInstances,
} from '../../__utils__/tracesTestHelpers';

// Mock processors
const mockProcessorInstances: any[] = [];

jest.mock('@src/openTelemetry/processors', () => ({
  RequestPathSpanProcessor: class MockRequestPathSpanProcessor {
    __type = 'RequestPathSpanProcessor';
    constructor() {
      mockConstructCalls.push(['RequestPathSpanProcessor']);
      mockProcessorInstances.push(this);
    }
  },
  SessionContextSpanProcessor: class MockSessionContextSpanProcessor {
    __type = 'SessionContextSpanProcessor';
    constructor() {
      mockConstructCalls.push(['SessionContextSpanProcessor']);
      mockProcessorInstances.push(this);
    }
  },
  FrustrationDetectionProcessor: class MockFrustrationDetectionProcessor {
    __type = 'FrustrationDetectionProcessor';
    constructor(config: any) {
      mockConstructCalls.push(['FrustrationDetectionProcessor', config]);
      mockProcessorInstances.push(this);
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

jest.mock('@src/openTelemetry/samplers', () => ({
  SessionSampler: class MockSessionSampler {
    __type = 'SessionSampler';
    rate: number;
    constructor(rate: number) {
      this.rate = rate;
      mockConstructCalls.push(['SessionSampler', rate]);
    }
    shouldSample() {
      return { decision: 1 };
    }
    reroll() {}
    toString() {
      return `SessionSampler{rate=${this.rate}}`;
    }
  },
}));

describe('Traces Provider - Span Processors Configuration', () => {
  beforeEach(() => {
    setupTracesTest();
    mockProcessorInstances.length = 0;
  });

  it('should create correct processors order without frustration detection', () => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const endpoint = 'https://traces.example.com';
    const config = createMockConfig({
      enable: { frustrationDetection: false },
    });

    getTraceProvider(resource, endpoint, config);

    const tracerCall = mockConstructCalls.find(([name]) => name === 'WebTracerProvider');
    const processors = tracerCall[1].spanProcessors;

    expect(processors).toHaveLength(3);
    expect(processors[0].__type).toBe('RequestPathSpanProcessor');
    expect(processors[1].__type).toBe('SessionContextSpanProcessor');
    expect(processors[2].constructor.name).toBe('MockBatchSpanProcessor');

    // Verify no FrustrationDetectionProcessor was created
    const frustrationCall = mockConstructCalls.find(
      ([name]) => name === 'FrustrationDetectionProcessor',
    );
    expect(frustrationCall).toBeUndefined();
  });

  it('should create correct processors order with frustration detection', () => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const endpoint = 'https://traces.example.com';
    const config = createMockConfig({
      enable: { frustrationDetection: true },
    });

    getTraceProvider(resource, endpoint, config);

    const tracerCall = mockConstructCalls.find(([name]) => name === 'WebTracerProvider');
    const processors = tracerCall[1].spanProcessors;

    expect(processors).toHaveLength(4);
    expect(processors[0].__type).toBe('RequestPathSpanProcessor');
    expect(processors[1].__type).toBe('SessionContextSpanProcessor');
    expect(processors[2].__type).toBe('FrustrationDetectionProcessor');
    expect(processors[3].constructor.name).toBe('MockBatchSpanProcessor');

    // Verify FrustrationDetectionProcessor was created with config
    const frustrationCall = mockConstructCalls.find(
      ([name]) => name === 'FrustrationDetectionProcessor',
    );
    expect(frustrationCall).toBeTruthy();
    expect(frustrationCall[1]).toBe(config);
  });

  it('should configure BatchSpanProcessor with correct constants', () => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const endpoint = 'https://traces.example.com';
    const config = createMockConfig();

    getTraceProvider(resource, endpoint, config);

    const batchProcessorCall = mockConstructCalls.find(([name]) => name === 'BatchSpanProcessor');
    expect(batchProcessorCall).toBeTruthy();

    const [, exporter, batchConfig] = batchProcessorCall;
    expect(batchConfig.maxExportBatchSize).toBe(MAX_BULK_SIZE);
    expect(batchConfig.scheduledDelayMillis).toBe(MAX_SPAN_WAIT_MS);
    expect(exporter).toBeDefined();
  });

  it('should create SessionContextSpanProcessor without arguments', () => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const endpoint = 'https://traces.example.com';
    const config = createMockConfig();

    getTraceProvider(resource, endpoint, config);

    const sessionProcessorCall = mockConstructCalls.find(
      ([name]) => name === 'SessionContextSpanProcessor',
    );
    expect(sessionProcessorCall).toBeTruthy();
    expect(sessionProcessorCall).toHaveLength(1); // Only the name, no additional arguments
  });

  it.each([
    { frustration: false, expectedCount: 3, description: 'without frustration detection' },
    { frustration: true, expectedCount: 4, description: 'with frustration detection' },
  ])('should create $expectedCount processors $description', ({ frustration, expectedCount }) => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const endpoint = 'https://traces.example.com';
    const config = createMockConfig({
      enable: { frustrationDetection: frustration },
    });

    getTraceProvider(resource, endpoint, config);

    const tracerCall = mockConstructCalls.find(([name]) => name === 'WebTracerProvider');
    const processors = tracerCall[1].spanProcessors;

    expect(processors).toHaveLength(expectedCount);

    // RequestPathSpanProcessor should always be first
    expect(processors[0].__type).toBe('RequestPathSpanProcessor');

    // SessionContextSpanProcessor should always be second
    expect(processors[1].__type).toBe('SessionContextSpanProcessor');

    // BatchSpanProcessor should always be last
    expect(processors[expectedCount - 1].constructor.name).toBe('MockBatchSpanProcessor');

    if (frustration) {
      // FrustrationDetectionProcessor should be third (before BatchSpanProcessor)
      expect(processors[2].__type).toBe('FrustrationDetectionProcessor');
    }
  });
});
