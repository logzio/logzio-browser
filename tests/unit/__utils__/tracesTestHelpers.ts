/**
 * Shared helpers and mocks for traces provider testing
 */

// Track all constructor calls for verification across tests
export const mockConstructCalls: any[] = [];
export const exporterInstances: any[] = [];

/**
 * Mock classes for OpenTelemetry SDK
 */

// Mock @opentelemetry/resources
export const createResourceMocks = () => {
  class MockResource {
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
  }
  return { Resource: MockResource };
};

// Mock @opentelemetry/sdk-trace-web
export const createTraceWebMocks = () => {
  class MockWebTracerProvider {
    options: any;
    constructor(options: any) {
      this.options = options;
      mockConstructCalls.push(['WebTracerProvider', options]);
    }
  }

  class MockBatchSpanProcessor {
    exporter: any;
    config: any;
    constructor(exporter: any, config: any) {
      this.exporter = exporter;
      this.config = config;
      mockConstructCalls.push(['BatchSpanProcessor', exporter, config]);
    }
  }

  return {
    WebTracerProvider: MockWebTracerProvider,
    BatchSpanProcessor: MockBatchSpanProcessor,
  };
};

// Mock @opentelemetry/exporter-trace-otlp-proto
export const createOtlpHttpMocks = () => {
  class MockOTLPTraceExporter {
    config: any;
    constructor(config: any) {
      this.config = config;
      mockConstructCalls.push(['OTLPTraceExporter', config]);
      exporterInstances.push(this);
    }
  }

  return {
    OTLPTraceExporter: MockOTLPTraceExporter,
  };
};

/**
 * Mock SessionSampler for traces provider tests
 */
export class MockSessionSampler {
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
}

/**
 * Test helper functions
 */
export const createMockResource = (attributes: any = {}) => {
  const MockResource = createResourceMocks().Resource;
  return new MockResource(attributes);
};

export const createMockSampler = (rate: number = 50) => new MockSessionSampler(rate);

export const createMockConfig = (overrides: any = {}) => {
  return {
    tokens: {
      traces: 'test-traces-token',
    },
    samplingRate: 50,
    region: 'us',
    ...overrides,
  };
};

/**
 * Setup function for traces tests - clears mock state
 */
export const setupTracesTest = () => {
  mockConstructCalls.length = 0;
  exporterInstances.length = 0;
};

/**
 * Standard mock configuration for traces provider tests
 */
export const tracesProviderMocks = {
  '@opentelemetry/resources': createResourceMocks(),
  '@opentelemetry/sdk-trace-web': createTraceWebMocks(),
  '@opentelemetry/exporter-trace-otlp-proto': createOtlpHttpMocks(),
};

/**
 * Common test data for sampling rates
 */
export const samplingTestCases = [
  { rate: 0, expectedType: 'SessionSampler', description: 'minimum sampling (0%)' },
  { rate: 25, expectedType: 'SessionSampler', description: 'partial sampling (25%)' },
  { rate: 50, expectedType: 'SessionSampler', description: 'half sampling (50%)' },
  { rate: 75, expectedType: 'SessionSampler', description: 'high sampling (75%)' },
  { rate: 100, expectedType: 'SessionSampler', description: 'maximum sampling (100%)' },
] as const;
