import {
  LOGZIO_REGION_HEADER,
  MAX_BULK_SIZE,
  MAX_LOG_WAIT_MS,
  AUTHORIZATION_HEADER,
  LOGZIO_DATA_TYPE_HEADER,
} from '../../../../src/openTelemetry/providers/constants';
import { getAuthorizationHeader } from '@src/utils/helpers';

// Track all constructor calls for verification
const mockConstructCalls: any[] = [];

// Mock Resource
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

// Mock @opentelemetry/resources
jest.mock('@opentelemetry/resources', () => ({
  Resource: MockResource,
}));

// Mock @opentelemetry/sdk-logs
jest.mock('@opentelemetry/sdk-logs', () => {
  class MockBatchLogRecordProcessor {
    exporter: any;
    config: any;
    constructor(exporter: any, config: any) {
      this.exporter = exporter;
      this.config = config;
      mockConstructCalls.push(['BatchLogRecordProcessor', exporter, config]);
    }
  }

  class MockLoggerProvider {
    options: any;
    constructor(options: any) {
      this.options = options;
      mockConstructCalls.push(['LoggerProvider', options]);
    }
  }

  return {
    BatchLogRecordProcessor: MockBatchLogRecordProcessor,
    LoggerProvider: MockLoggerProvider,
  };
});

// Mock SessionContextLogProcessor
const sessionProcessorInstances: any[] = [];
jest.mock('@src/openTelemetry/processors', () => {
  class MockSessionContextLogProcessor {
    __type = 'SessionContextLogProcessor';
    constructor() {
      sessionProcessorInstances.push(this);
      mockConstructCalls.push(['SessionContextLogProcessor']);
    }
  }
  return { SessionContextLogProcessor: MockSessionContextLogProcessor };
});

// Mock OTLPLogExporter
const exporterInstances: any[] = [];
jest.mock('@opentelemetry/exporter-logs-otlp-proto', () => {
  class MockOTLPLogExporter {
    options: any;
    constructor(options: any) {
      this.options = options;
      exporterInstances.push(this);
      mockConstructCalls.push(['OTLPLogExporter', options]);
    }
  }
  return { OTLPLogExporter: MockOTLPLogExporter };
});

// SUT - import once after mocks are defined

const { getLogProvider } = require('@src/openTelemetry/providers/logs');

describe('logs provider', () => {
  beforeEach(() => {
    mockConstructCalls.length = 0;
    sessionProcessorInstances.length = 0;
    exporterInstances.length = 0;
  });

  it('should create LoggerProvider with resource and processors', () => {
    const endpoint = 'https://logs.example.com';
    const resource = new MockResource({ serviceName: 'test-service' });

    const provider = getLogProvider(resource, endpoint, { region: 'us', tokens: { logs: 't' } });

    // Verify LoggerProvider was created
    expect(provider).toBeDefined();
    const loggerCall = mockConstructCalls.find(([name]) => name === 'LoggerProvider');
    expect(loggerCall).toBeTruthy();

    // Verify resource was passed through
    const options = loggerCall[1];
    expect(options.resource).toBe(resource);
    expect(Array.isArray(options.processors)).toBe(true);
    expect(options.processors).toHaveLength(2);
  });

  it('should create processors in correct order', () => {
    const endpoint = 'https://logs.example.com';
    const resource = new MockResource({ serviceName: 'test-service' });

    getLogProvider(resource, endpoint, { region: 'us', tokens: { logs: 't' } });

    const loggerCall = mockConstructCalls.find(([name]) => name === 'LoggerProvider');
    const processors = loggerCall[1].processors;

    // First processor should be SessionContextLogProcessor
    const sessionProcessor = processors[0];
    expect(sessionProcessor.__type).toBe('SessionContextLogProcessor');

    // Second processor should be BatchLogRecordProcessor
    const batchProcessor = processors[1];
    expect(batchProcessor.constructor.name).toBe('MockBatchLogRecordProcessor');
  });

  it('should configure BatchLogRecordProcessor with correct constants', () => {
    const endpoint = 'https://logs.example.com';
    const resource = new MockResource({ serviceName: 'test-service' });

    getLogProvider(resource, endpoint, { region: 'us', tokens: { logs: 't' } });

    const batchProcessorCall = mockConstructCalls.find(
      ([name]) => name === 'BatchLogRecordProcessor',
    );
    expect(batchProcessorCall).toBeTruthy();

    const [, exporter, config] = batchProcessorCall;
    expect(config.maxExportBatchSize).toBe(MAX_BULK_SIZE);
    expect(config.scheduledDelayMillis).toBe(MAX_LOG_WAIT_MS);
    expect(exporter).toBeDefined();
  });

  it('should create OTLPLogExporter with correct endpoint and headers', () => {
    const endpoint = 'https://logs.example.com/v1/logs';
    const resource = new MockResource({ serviceName: 'test-service' });

    getLogProvider(resource, endpoint, { region: 'us', tokens: { logs: 't' } });

    const exporterCall = mockConstructCalls.find(([name]) => name === 'OTLPLogExporter');
    expect(exporterCall).toBeTruthy();

    const [, options] = exporterCall;
    expect(options.url).toBe(endpoint);
    expect(options.headers).toEqual({
      [LOGZIO_REGION_HEADER]: 'us',
      [AUTHORIZATION_HEADER]: getAuthorizationHeader('t'),
      [LOGZIO_DATA_TYPE_HEADER]: 'logs',
    });
  });

  it('should not throw with various endpoint formats', () => {
    const resource = new MockResource({ serviceName: 'test-service' });

    const endpoints = [
      '',
      'https://example.com',
      'https://example.com/',
      'https://example.com/logs',
      'https://example.com/logs?query=param',
      'http://localhost:3000',
      'http://localhost:3000/api/v1/logs',
    ];

    endpoints.forEach((endpoint: string) => {
      expect(() =>
        getLogProvider(resource, endpoint, { region: 'us', tokens: { logs: 't' } }),
      ).not.toThrow();
    });
  });

  it('should pass endpoint URL through to exporter without modification', () => {
    const testCases = [
      'https://logs.logz.io/v1/logs',
      'http://localhost:8080/logs',
      'https://api.example.com/telemetry/logs?token=abc123',
    ];

    const resource = new MockResource({ serviceName: 'test-service' });

    for (const endpoint of testCases) {
      // Clear previous calls
      mockConstructCalls.length = 0;
      exporterInstances.length = 0;
      getLogProvider(resource, endpoint, { region: 'us', tokens: { logs: 't' } });

      const exporterCall = mockConstructCalls.find(([name]) => name === 'OTLPLogExporter');
      expect(exporterCall[1].url).toBe(endpoint);
    }
  });

  it('should return LoggerProvider instance', () => {
    const endpoint = 'https://logs.example.com';
    const resource = new MockResource({ serviceName: 'test-service' });

    const provider = getLogProvider(resource, endpoint, { region: 'us', tokens: { logs: 't' } });

    // Should return the mocked LoggerProvider instance
    expect(provider).toBeDefined();
    expect(provider.constructor.name).toBe('MockLoggerProvider');
  });

  it('should create SessionContextLogProcessor without arguments', () => {
    const endpoint = 'https://logs.example.com';
    const resource = new MockResource({ serviceName: 'test-service' });

    getLogProvider(resource, endpoint, { region: 'us', tokens: { logs: 't' } });

    const sessionProcessorCall = mockConstructCalls.find(
      ([name]) => name === 'SessionContextLogProcessor',
    );
    expect(sessionProcessorCall).toBeTruthy();
    expect(sessionProcessorCall).toHaveLength(1); // Only the name, no additional arguments
  });

  it('should wire exporter to BatchLogRecordProcessor correctly', () => {
    const endpoint = 'https://logs.example.com';
    const resource = new MockResource({ serviceName: 'test-service' });

    getLogProvider(resource, endpoint, { region: 'us', tokens: { logs: 't' } });

    const exporterCall = mockConstructCalls.find(([name]) => name === 'OTLPLogExporter');
    const batchProcessorCall = mockConstructCalls.find(
      ([name]) => name === 'BatchLogRecordProcessor',
    );

    expect(exporterCall).toBeTruthy();
    expect(batchProcessorCall).toBeTruthy();

    // The exporter instance should be passed to the BatchLogRecordProcessor
    const exporterInstance = exporterInstances[0];
    const [, passedExporter] = batchProcessorCall;
    expect(passedExporter).toBe(exporterInstance);
  });
});
