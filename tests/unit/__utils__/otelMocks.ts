/**
 * Centralized OpenTelemetry mocks for testing
 */

// Mock providers
export const mockGetTraceProvider = jest.fn(() => ({
  register: jest.fn(),
  forceFlush: jest.fn(),
  shutdown: jest.fn().mockResolvedValue(undefined),
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

jest.mock('@opentelemetry/instrumentation', () => ({
  registerInstrumentations: mockRegisterInstrumentations,
}));

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
export const MockErrorTrackingInstrumentation = jest
  .fn()
  .mockImplementation((config) => ({ type: 'ErrorTracking', config }));
export const MockLogzioUserInteractionInstrumentation = jest
  .fn()
  .mockImplementation((config) => ({ type: 'UserInteraction', config }));
export const MockConsoleLogsInstrumentation = jest
  .fn()
  .mockImplementation((config) => ({ type: 'ConsoleLogs', config }));

jest.mock('@src/instrumentation', () => ({
  ErrorTrackingInstrumentation: MockErrorTrackingInstrumentation,
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
