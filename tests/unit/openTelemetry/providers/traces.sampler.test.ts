import { getTraceProvider } from '../../../../src/openTelemetry/providers/traces';
import {
  setupTracesTest,
  mockConstructCalls,
  exporterInstances,
  createMockResource,
  createMockConfig,
  samplingTestCases,
} from '../../__utils__/tracesTestHelpers';

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

describe('Traces Provider - Sampler Selection', () => {
  beforeEach(() => {
    setupTracesTest();
  });

  it('should use SessionSampler with the configured sampling rate', () => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const endpoint = 'https://traces.example.com';
    const config = createMockConfig({ samplingRate: 75 });

    getTraceProvider(resource, endpoint, config);

    const tracerCall = mockConstructCalls.find(([name]) => name === 'WebTracerProvider');
    const sampler = tracerCall[1].sampler;
    expect(sampler.__type).toBe('SessionSampler');
    expect(sampler.rate).toBe(75);
  });

  it('should use SessionSampler when samplingRate is 0', () => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const endpoint = 'https://traces.example.com';
    const config = createMockConfig({ samplingRate: 0 });

    getTraceProvider(resource, endpoint, config);

    const tracerCall = mockConstructCalls.find(([name]) => name === 'WebTracerProvider');
    const sampler = tracerCall[1].sampler;
    expect(sampler.__type).toBe('SessionSampler');
    expect(sampler.rate).toBe(0);
  });

  it('should use SessionSampler when samplingRate is 100', () => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const endpoint = 'https://traces.example.com';
    const config = createMockConfig({ samplingRate: 100 });

    getTraceProvider(resource, endpoint, config);

    const tracerCall = mockConstructCalls.find(([name]) => name === 'WebTracerProvider');
    const sampler = tracerCall[1].sampler;
    expect(sampler.__type).toBe('SessionSampler');
    expect(sampler.rate).toBe(100);
  });

  it('should return the sampler alongside the provider', () => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const endpoint = 'https://traces.example.com';
    const config = createMockConfig({ samplingRate: 50 });

    const result = getTraceProvider(resource, endpoint, config);

    expect(result.provider).toBeDefined();
    expect(result.sampler).toBeDefined();
    expect((result.sampler as any).__type).toBe('SessionSampler');
  });

  it.each(samplingTestCases)(
    'should use SessionSampler for $description',
    ({ rate, expectedType }) => {
      const resource = createMockResource({ serviceName: 'test-service' });
      const endpoint = 'https://traces.example.com';
      const config = createMockConfig({ samplingRate: rate });

      getTraceProvider(resource, endpoint, config);

      const tracerCall = mockConstructCalls.find(([name]) => name === 'WebTracerProvider');
      const sampler = tracerCall[1].sampler;
      expect(sampler.__type).toBe(expectedType);
    },
  );
});
