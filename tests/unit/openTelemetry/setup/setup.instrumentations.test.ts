/**
 * Tests for OpenTelemetryProvider instrumentation registration
 */
import { createConfig } from '../../__utils__/configFactory';
import { createProviderInstance, resetProviderSingleton } from '../../__utils__/providerHelpers';
import {
  mockRegisterInstrumentations,
  MockDocumentLoadInstrumentation,
  MockFetchInstrumentation,
  MockXMLHttpRequestInstrumentation,
  MockErrorTrackingInstrumentation,
  MockLogzioUserInteractionInstrumentation,
  MockConsoleLogsInstrumentation,
} from '../../__utils__/otelMocks';

describe('OpenTelemetryProvider Instrumentation Registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetProviderSingleton();
  });

  describe('navigation tracker', () => {
    it('should call navigationTracker.init once', () => {
      const config = createConfig();
      const mockNavigationTracker = { init: jest.fn() };

      const provider = createProviderInstance(config);
      provider.registerInstrumentations(mockNavigationTracker);

      expect(mockNavigationTracker.init).toHaveBeenCalledTimes(1);
    });
  });

  describe('user interactions', () => {
    it('should register user actions instrumentation when enabled', () => {
      const config = createConfig({
        enable: { userActions: true },
        frustrationThresholds: { heavyLoadThresholdMs: 3000 },
      });
      const mockNavigationTracker = { init: jest.fn() };

      const provider = createProviderInstance(config);
      provider.registerInstrumentations(mockNavigationTracker);

      expect(MockLogzioUserInteractionInstrumentation).toHaveBeenCalledWith({
        frustrationThresholds: { heavyLoadThresholdMs: 3000 },
        navigationTracker: mockNavigationTracker,
      });

      expect(mockRegisterInstrumentations).toHaveBeenCalledWith({
        instrumentations: expect.arrayContaining([
          expect.objectContaining({ type: 'UserInteraction' }),
        ]),
      });
    });
  });

  describe('document load', () => {
    it('should register document load instrumentation when enabled', () => {
      const config = createConfig({
        enable: { documentLoad: true },
      });
      const mockNavigationTracker = { init: jest.fn() };

      const provider = createProviderInstance(config);
      provider.registerInstrumentations(mockNavigationTracker);

      expect(MockDocumentLoadInstrumentation).toHaveBeenCalledWith();
      expect(mockRegisterInstrumentations).toHaveBeenCalledWith({
        instrumentations: expect.arrayContaining([
          expect.objectContaining({ type: 'DocumentLoad' }),
        ]),
      });
    });
  });

  describe('resource load', () => {
    it('should register resource load instrumentations with empty config when no CORS URLs', () => {
      const config = createConfig({
        enable: { resourceLoad: true },
        propagateTraceHeaderCorsUrls: [],
      });
      const mockNavigationTracker = { init: jest.fn() };

      const provider = createProviderInstance(config);
      provider.registerInstrumentations(mockNavigationTracker);

      expect(MockFetchInstrumentation).toHaveBeenCalledWith({});
      expect(MockXMLHttpRequestInstrumentation).toHaveBeenCalledWith({});

      expect(mockRegisterInstrumentations).toHaveBeenCalledWith({
        instrumentations: expect.arrayContaining([
          expect.objectContaining({ type: 'Fetch', config: {} }),
          expect.objectContaining({ type: 'XHR', config: {} }),
        ]),
      });
    });

    it('should register resource load instrumentations with CORS URLs when provided', () => {
      const corsUrls = ['https://api.example.com', 'https://cdn.example.com'];
      const config = createConfig({
        enable: { resourceLoad: true },
        propagateTraceHeaderCorsUrls: corsUrls,
      });
      const mockNavigationTracker = { init: jest.fn() };

      const provider = createProviderInstance(config);
      provider.registerInstrumentations(mockNavigationTracker);

      const expectedConfig = { propagateTraceHeaderCorsUrls: corsUrls };
      expect(MockFetchInstrumentation).toHaveBeenCalledWith(expectedConfig);
      expect(MockXMLHttpRequestInstrumentation).toHaveBeenCalledWith(expectedConfig);

      expect(mockRegisterInstrumentations).toHaveBeenCalledWith({
        instrumentations: expect.arrayContaining([
          expect.objectContaining({ type: 'Fetch', config: expectedConfig }),
          expect.objectContaining({ type: 'XHR', config: expectedConfig }),
        ]),
      });
    });
  });

  describe('error tracking', () => {
    it('should register error tracking instrumentation when enabled', () => {
      const config = createConfig({
        enable: { errorTracking: true },
      });
      const mockNavigationTracker = { init: jest.fn() };

      const provider = createProviderInstance(config);
      provider.registerInstrumentations(mockNavigationTracker);

      expect(MockErrorTrackingInstrumentation).toHaveBeenCalledWith({});
      expect(mockRegisterInstrumentations).toHaveBeenCalledWith({
        instrumentations: expect.arrayContaining([
          expect.objectContaining({ type: 'ErrorTracking' }),
        ]),
      });
    });
  });

  describe('console logs', () => {
    it('should register console logs instrumentation when enabled', () => {
      const config = createConfig({
        enable: { consoleLogs: true },
      });
      const mockNavigationTracker = { init: jest.fn() };

      const provider = createProviderInstance(config);
      provider.registerInstrumentations(mockNavigationTracker);

      expect(MockConsoleLogsInstrumentation).toHaveBeenCalledWith({});
      expect(mockRegisterInstrumentations).toHaveBeenCalledWith({
        instrumentations: expect.arrayContaining([
          expect.objectContaining({ type: 'ConsoleLogs' }),
        ]),
      });
    });
  });

  describe('instrumentation order and lifecycle', () => {
    it('should register instrumentations in correct order', () => {
      const config = createConfig({
        enable: {
          userActions: true,
          documentLoad: true,
          resourceLoad: true,
          errorTracking: true,
          consoleLogs: true,
        },
      });
      const mockNavigationTracker = { init: jest.fn() };

      const provider = createProviderInstance(config);
      provider.registerInstrumentations(mockNavigationTracker);

      const registeredCall = mockRegisterInstrumentations.mock.calls[0][0];
      const instrumentations = registeredCall.instrumentations;

      expect(instrumentations[0]).toEqual(expect.objectContaining({ type: 'UserInteraction' }));
      expect(instrumentations[1]).toEqual(expect.objectContaining({ type: 'DocumentLoad' }));
      expect(instrumentations[2]).toEqual(expect.objectContaining({ type: 'Fetch' }));
      expect(instrumentations[3]).toEqual(expect.objectContaining({ type: 'XHR' }));
      expect(instrumentations[4]).toEqual(expect.objectContaining({ type: 'ErrorTracking' }));
      expect(instrumentations[5]).toEqual(expect.objectContaining({ type: 'ConsoleLogs' }));
    });

    it('should not throw when all instrumentations are disabled', () => {
      const config = createConfig({
        enable: {
          userActions: false,
          documentLoad: false,
          resourceLoad: false,
          errorTracking: false,
          consoleLogs: false,
        },
      });
      const mockNavigationTracker = { init: jest.fn() };

      const provider = createProviderInstance(config);

      expect(() => provider.registerInstrumentations(mockNavigationTracker)).not.toThrow();
      expect(mockRegisterInstrumentations).toHaveBeenCalledWith({
        instrumentations: [],
      });
    });
  });
});
