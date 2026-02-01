/**
 * Tests for OpenTelemetryProvider instrumentation registration
 */
import { ExceptionInstrumentation } from '@opentelemetry/instrumentation-web-exception';
import { createConfig } from '../../__utils__/configFactory';
import { createProviderInstance, resetProviderSingleton } from '../../__utils__/providerHelpers';
import {
  mockRegisterInstrumentations,
  MockDocumentLoadInstrumentation,
  MockFetchInstrumentation,
  MockXMLHttpRequestInstrumentation,
  MockLogzioUserInteractionInstrumentation,
  MockConsoleLogsInstrumentation,
} from '../../__utils__/otelMocks';

describe('OpenTelemetryProvider Instrumentation Registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetProviderSingleton();
  });

  describe('navigation tracker', () => {
    it('should register instrumentations without errors', () => {
      const config = createConfig();

      const provider = createProviderInstance(config);

      expect(() => provider.registerInstrumentations()).not.toThrow();
    });
  });

  describe('user interactions', () => {
    it('should register user actions instrumentation when enabled', () => {
      const config = createConfig({
        enable: { userActions: true, navigation: true },
        frustrationThresholds: { heavyLoadThresholdMs: 3000 },
      });

      const provider = createProviderInstance(config);
      provider.registerInstrumentations();

      expect(MockLogzioUserInteractionInstrumentation).toHaveBeenCalledWith({
        frustrationThresholds: { heavyLoadThresholdMs: 3000 },
        trackNavigation: true, // Updated to expect trackNavigation boolean
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
      const provider = createProviderInstance(config);
      provider.registerInstrumentations();

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
      const provider = createProviderInstance(config);
      provider.registerInstrumentations();

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
      const provider = createProviderInstance(config);
      provider.registerInstrumentations();

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
      const provider = createProviderInstance(config);
      provider.registerInstrumentations();

      const registeredCall = mockRegisterInstrumentations.mock.calls[0][0];
      const instrumentations = registeredCall.instrumentations;

      expect(
        instrumentations.some((inst: unknown) => inst instanceof ExceptionInstrumentation),
      ).toBe(true);
    });
  });

  describe('console logs', () => {
    it('should register console logs instrumentation when enabled', () => {
      const config = createConfig({
        enable: { consoleLogs: true },
      });
      const provider = createProviderInstance(config);
      provider.registerInstrumentations();

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
      const provider = createProviderInstance(config);
      provider.registerInstrumentations();

      const registeredCall = mockRegisterInstrumentations.mock.calls[0][0];
      const instrumentations = registeredCall.instrumentations;

      expect(instrumentations[0]).toEqual(expect.objectContaining({ type: 'UserInteraction' }));
      expect(instrumentations[1]).toEqual(expect.objectContaining({ type: 'DocumentLoad' }));
      expect(instrumentations[2]).toEqual(expect.objectContaining({ type: 'Fetch' }));
      expect(instrumentations[3]).toEqual(expect.objectContaining({ type: 'XHR' }));
      expect(instrumentations[4]).toBeInstanceOf(ExceptionInstrumentation);
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
