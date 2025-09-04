import { getTraceProvider } from '../../../../src/openTelemetry/providers/traces';
import {
  MAX_SAMPLING_PERCENTAGE,
  MIN_SAMPLING_PERCENTAGE,
} from '../../../../src/openTelemetry/providers/constants';
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

describe('Traces Provider - Sampler Selection', () => {
  beforeEach(() => {
    setupTracesTest();
  });

  it('should use AlwaysOnSampler when samplingRate is MAX_SAMPLING_PERCENTAGE', () => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const endpoint = 'https://traces.example.com';
    const config = createMockConfig({ samplingRate: MAX_SAMPLING_PERCENTAGE });

    getTraceProvider(resource, endpoint, config);

    const tracerCall = mockConstructCalls.find(([name]) => name === 'WebTracerProvider');
    const sampler = tracerCall[1].sampler;
    expect(sampler.__type).toBe('AlwaysOnSampler');
  });

  it('should use AlwaysOffSampler when samplingRate is MIN_SAMPLING_PERCENTAGE', () => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const endpoint = 'https://traces.example.com';
    const config = createMockConfig({ samplingRate: MIN_SAMPLING_PERCENTAGE });

    getTraceProvider(resource, endpoint, config);

    const tracerCall = mockConstructCalls.find(([name]) => name === 'WebTracerProvider');
    const sampler = tracerCall[1].sampler;
    expect(sampler.__type).toBe('AlwaysOffSampler');
  });

  it('should use TraceIdRatioBasedSampler for intermediate sampling rates', () => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const endpoint = 'https://traces.example.com';
    const config = createMockConfig({ samplingRate: 50 });

    getTraceProvider(resource, endpoint, config);

    const tracerCall = mockConstructCalls.find(([name]) => name === 'WebTracerProvider');
    const sampler = tracerCall[1].sampler;
    expect(sampler.__type).toBe('TraceIdRatioBasedSampler');
    expect(sampler.ratio).toBe(0.5);
  });

  it.each(samplingTestCases)(
    'should correctly select $expectedType for $description',
    ({ rate, expectedType }) => {
      const resource = createMockResource({ serviceName: 'test-service' });
      const endpoint = 'https://traces.example.com';
      const config = createMockConfig({ samplingRate: rate });

      getTraceProvider(resource, endpoint, config);

      const tracerCall = mockConstructCalls.find(([name]) => name === 'WebTracerProvider');
      const sampler = tracerCall[1].sampler;
      expect(sampler.__type).toBe(expectedType);

      if (expectedType === 'TraceIdRatioBasedSampler') {
        expect(sampler.ratio).toBe(rate / 100);
      }
    },
  );

  it('should use TraceIdRatioBasedSampler for sampling rate just above minimum', () => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const endpoint = 'https://traces.example.com';
    const configJustAboveMin = createMockConfig({ samplingRate: MIN_SAMPLING_PERCENTAGE + 1 });

    getTraceProvider(resource, endpoint, configJustAboveMin);

    const tracerCall = mockConstructCalls.find(([name]) => name === 'WebTracerProvider');
    expect(tracerCall[1].sampler.__type).toBe('TraceIdRatioBasedSampler');
    expect(tracerCall[1].sampler.ratio).toBe(0.01);
  });

  it('should use TraceIdRatioBasedSampler for sampling rate just below maximum', () => {
    const resource = createMockResource({ serviceName: 'test-service' });
    const endpoint = 'https://traces.example.com';
    const configJustBelowMax = createMockConfig({ samplingRate: MAX_SAMPLING_PERCENTAGE - 1 });

    getTraceProvider(resource, endpoint, configJustBelowMax);

    const tracerCall = mockConstructCalls.find(([name]) => name === 'WebTracerProvider');
    expect(tracerCall[1].sampler.__type).toBe('TraceIdRatioBasedSampler');
    expect(tracerCall[1].sampler.ratio).toBe(0.99);
  });
});
