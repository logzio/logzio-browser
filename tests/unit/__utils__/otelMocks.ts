/**
 * Centralized OpenTelemetry mocks for testing
 */

// Mock providers
export const mockGetTraceProvider = jest.fn(() => ({
  provider: {
    register: jest.fn(),
    forceFlush: jest.fn(),
    shutdown: jest.fn().mockResolvedValue(undefined),
  },
  sampler: {
    reroll: jest.fn(),
    shouldSample: jest.fn(() => ({ decision: 1 })),
    toString: jest.fn(() => 'SessionSampler{rate=100, sampled=true}'),
  },
}));

export const mockGetMetricsProvider = jest.fn(() => ({
  forceFlush: jest.fn(),
  shutdown: jest.fn().mockResolvedValue(undefined),
}));

export const mockGetLogProvider = jest.fn(() => ({
  forceFlush: jest.fn(),
  shutdown: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@src/openTelemetry/providers', () => ({
  getTraceProvider: mockGetTraceProvider,
  getMetricsProvider: mockGetMetricsProvider,
  getLogProvider: mockGetLogProvider,
}));

// Mock OpenTelemetry API
export const mockSetGlobalContextManager = jest.fn();
export const mockSetGlobalMeterProvider = jest.fn();

jest.mock('@opentelemetry/api', () => {
  const originalModule = jest.requireActual('@opentelemetry/api');
  return {
    ...originalModule,
    context: {
      setGlobalContextManager: mockSetGlobalContextManager,
    },
    metrics: {
      setGlobalMeterProvider: mockSetGlobalMeterProvider,
    },
  };
});

// Mock OpenTelemetry API Logs
export const mockSetGlobalLoggerProvider = jest.fn();

jest.mock('@opentelemetry/api-logs', () => ({
  logs: {
    setGlobalLoggerProvider: mockSetGlobalLoggerProvider,
  },
}));

// Mock instrumentation registration
export const mockRegisterInstrumentations = jest.fn();

jest.mock('@opentelemetry/instrumentation', () => {
  const actualModule = jest.requireActual('@opentelemetry/instrumentation');
  return {
    ...actualModule,
    registerInstrumentations: mockRegisterInstrumentations,
  };
});

// Mock instrumentations
export const MockDocumentLoadInstrumentation = jest
  .fn()
  .mockImplementation(() => ({ type: 'DocumentLoad' }));
export const MockFetchInstrumentation = jest
  .fn()
  .mockImplementation((config) => ({ type: 'Fetch', config }));
export const MockXMLHttpRequestInstrumentation = jest
  .fn()
  .mockImplementation((config) => ({ type: 'XHR', config }));

jest.mock('@opentelemetry/instrumentation-document-load', () => ({
  DocumentLoadInstrumentation: MockDocumentLoadInstrumentation,
}));

jest.mock('@opentelemetry/instrumentation-fetch', () => ({
  FetchInstrumentation: MockFetchInstrumentation,
}));

jest.mock('@opentelemetry/instrumentation-xml-http-request', () => ({
  XMLHttpRequestInstrumentation: MockXMLHttpRequestInstrumentation,
}));

// Mock custom instrumentations
export const MockLogzioUserInteractionInstrumentation = jest
  .fn()
  .mockImplementation((config) => ({ type: 'UserInteraction', config }));
export const MockConsoleLogsInstrumentation = jest
  .fn()
  .mockImplementation((config) => ({ type: 'ConsoleLogs', config }));

jest.mock('@src/instrumentation', () => ({
  ExceptionHelper: {
    getCustomAttributes: jest.fn(),
  },
  LogzioUserInteractionInstrumentation: MockLogzioUserInteractionInstrumentation,
  ConsoleLogsInstrumentation: MockConsoleLogsInstrumentation,
}));

// Mock LogzioContextManager
export const mockGetContextManagerInstance = jest.fn(() => ({
  setInitialCustomAttributes: jest.fn(),
  enable: jest.fn(),
}));

jest.mock('@src/context/LogzioContextManager', () => ({
  LogzioContextManager: {
    getInstance: mockGetContextManagerInstance,
  },
}));

// Mock EnvironmentCollector
export const mockEnvironmentCollect = jest.fn(() => ({}));

jest.mock('@src/utils', () => ({
  EnvironmentCollector: {
    collect: mockEnvironmentCollect,
  },
}));

// Mock resources
export class MockResource {
  constructor(public attributes: Record<string, any> = {}) {}

  merge(other: MockResource): MockResource {
    return new MockResource({ ...this.attributes, ...other.attributes });
  }
}

const mockEmptyResource = () => new MockResource({});
const mockResourceFromAttributes = (attrs: Record<string, any>) => new MockResource(attrs);

jest.mock('@opentelemetry/resources', () => ({
  emptyResource: mockEmptyResource,
  resourceFromAttributes: mockResourceFromAttributes,
  MockResource,
}));

/**
 * Reset all mocks to their initial state
 */
export function resetAllMocks() {
  jest.clearAllMocks();
}
