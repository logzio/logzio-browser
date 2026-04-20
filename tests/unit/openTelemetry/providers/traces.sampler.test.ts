import { getTraceProvider } from '../../../../src/openTelemetry/providers/traces';
import { SessionSampler } from '../../../../src/openTelemetry/samplers';
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

  it('should create SessionSampler with the configured sampling rate', () => {
    const sampler = new SessionSampler(75);

    expect((sampler as any).__type).toBe('SessionSampler');
    expect((sampler as any).rate).toBe(75);
  });

  it('should create SessionSampler when samplingRate is 0', () => {
    const sampler = new SessionSampler(0);

    expect((sampler as any).__type).toBe('SessionSampler');
    expect((sampler as any).rate).toBe(0);
  });

  it('should create SessionSampler when samplingRate is 100', () => {
    const sampler = new SessionSampler(100);

    expect((sampler as any).__type).toBe('SessionSampler');
    expect((sampler as any).rate).toBe(100);
  });

  it('should pass sampler through to WebTracerProvider', () => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const endpoint = 'https://traces.example.com';
    const config = createMockConfig({ samplingRate: 50 });
    const sampler = new SessionSampler(config.samplingRate);

    const provider = getTraceProvider(resource, endpoint, config, sampler);

    expect(provider).toBeDefined();
    const tracerCall = mockConstructCalls.find(([name]) => name === 'WebTracerProvider');
    expect(tracerCall[1].sampler).toBe(sampler);
  });

  it.each(samplingTestCases)(
    'should use SessionSampler for $description',
    ({ rate, expectedType }) => {
      const sampler = new SessionSampler(rate);

      expect((sampler as any).__type).toBe(expectedType);
    },
  );
});
