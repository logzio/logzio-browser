import { RUMConfig } from '../../../../src/config';
import { createConfig } from '../../__utils__/configFactory';
import { createProviderInstance, resetProviderSingleton } from '../../__utils__/providerHelpers';
import {
  mockGetTraceProvider,
  mockGetMetricsProvider,
  mockGetLogProvider,
} from '../../__utils__/otelMocks';

// Mock shared dependencies using centralized helper
jest.mock('@src/shared', () => {
  const { createSharedMock } = require('../../__utils__/loggerMocks');
  return createSharedMock();
});

describe('OpenTelemetryProvider Endpoint Resolution', () => {
  let mockRumLogger: { warn: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    resetProviderSingleton();

    const shared = require('@src/shared');
    mockRumLogger = shared.rumLogger;
  });

  describe('default endpoint behavior', () => {
    it('should use default endpoint with suffix when no customEndpoint is provided', () => {
      const config = new RUMConfig(
        createConfig({
          tokens: { traces: 'trace-token', metrics: 'metrics-token', logs: 'logs-token' },
        }) as any,
      );

      const provider = createProviderInstance(config);
      provider.registerProviders();

      expect(mockGetTraceProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://whatever/third/party/logzio/endpoint/traces',
        config,
      );
      expect(mockGetMetricsProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://whatever/third/party/logzio/endpoint/metrics',
      );
      expect(mockGetLogProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://whatever/third/party/logzio/endpoint/logs',
      );
    });
  });

  describe('custom endpoint with suffix', () => {
    it('should use custom endpoint with suffix when addSuffix is true', () => {
      const config = new RUMConfig(
        createConfig({
          tokens: { traces: 'trace-token', metrics: 'metrics-token', logs: 'logs-token' },
          customEndpoint: { url: 'https://custom.endpoint.com', addSuffix: true },
        }) as any,
      );

      const provider = createProviderInstance(config);
      provider.registerProviders();

      expect(mockGetTraceProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://custom.endpoint.com/traces',
        config,
      );
      expect(mockGetMetricsProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://custom.endpoint.com/metrics',
      );
      expect(mockGetLogProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://custom.endpoint.com/logs',
      );
    });

    it('should handle trailing slash in custom endpoint', () => {
      const config = new RUMConfig(
        createConfig({
          tokens: { traces: 'trace-token', metrics: 'metrics-token', logs: 'logs-token' },
          customEndpoint: { url: 'https://custom.endpoint.com/', addSuffix: true },
        }) as any,
      );

      const provider = createProviderInstance(config);
      provider.registerProviders();

      expect(mockGetTraceProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://custom.endpoint.com/traces',
        config,
      );
      expect(mockGetMetricsProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://custom.endpoint.com/metrics',
      );
      expect(mockGetLogProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://custom.endpoint.com/logs',
      );
    });
  });

  describe('custom endpoint without suffix', () => {
    it('should use custom endpoint as-is when addSuffix is false', () => {
      const config = new RUMConfig(
        createConfig({
          tokens: { traces: 'trace-token', metrics: 'metrics-token', logs: 'logs-token' },
          customEndpoint: { url: 'https://custom.endpoint.com/api/v1', addSuffix: false },
        }) as any,
      );

      const provider = createProviderInstance(config);
      provider.registerProviders();

      expect(mockGetTraceProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://custom.endpoint.com/api/v1',
        config,
      );
      expect(mockGetMetricsProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://custom.endpoint.com/api/v1',
      );
      expect(mockGetLogProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://custom.endpoint.com/api/v1',
      );
    });
  });

  describe('invalid custom endpoint', () => {
    it('should warn and fall back to default endpoint when custom URL is invalid', () => {
      const config = new RUMConfig(
        createConfig({
          tokens: { traces: 'trace-token', metrics: 'metrics-token', logs: 'logs-token' },
          customEndpoint: { url: 'invalid-url', addSuffix: true },
        }) as any,
      );

      const provider = createProviderInstance(config);
      provider.registerProviders();

      expect(mockRumLogger.warn).toHaveBeenCalledWith(
        'Invalid custom endpoint URL "invalid-url". Falling back to default endpoint.',
      );
      expect(mockGetTraceProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://whatever/third/party/logzio/endpoint/traces',
        config,
      );
      expect(mockGetMetricsProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://whatever/third/party/logzio/endpoint/metrics',
      );
      expect(mockGetLogProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://whatever/third/party/logzio/endpoint/logs',
      );
    });

    it('should not throw when custom URL is invalid', () => {
      const config = new RUMConfig(
        createConfig({
          tokens: { traces: 'trace-token' },
          customEndpoint: { url: 'not-a-url', addSuffix: true },
        }) as any,
      );

      expect(() => {
        const provider = createProviderInstance(config);
        provider.registerProviders();
      }).not.toThrow();
    });
  });

  describe('empty custom endpoint', () => {
    it('should use default endpoint when custom URL is empty', () => {
      const config = new RUMConfig(
        createConfig({
          tokens: { traces: 'trace-token', metrics: 'metrics-token', logs: 'logs-token' },
          customEndpoint: { url: '', addSuffix: false },
        }) as any,
      );

      const provider = createProviderInstance(config);
      provider.registerProviders();

      expect(mockGetTraceProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://whatever/third/party/logzio/endpoint/traces',
        config,
      );
      expect(mockGetMetricsProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://whatever/third/party/logzio/endpoint/metrics',
      );
      expect(mockGetLogProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://whatever/third/party/logzio/endpoint/logs',
      );
    });
  });
});
