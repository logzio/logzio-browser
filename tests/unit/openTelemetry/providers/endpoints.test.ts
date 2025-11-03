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
  beforeEach(() => {
    jest.clearAllMocks();
    resetProviderSingleton();
  });

  describe('default endpoint behavior', () => {
    it('should use default endpoint with suffix when endpoint is provided', () => {
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
      // Metrics provider is called twice (DELTA and CUMULATIVE), check both calls have correct endpoint
      expect(mockGetMetricsProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://whatever/third/party/logzio/endpoint/metrics',
        config,
        expect.anything(), // AggregationTemporality (DELTA or CUMULATIVE)
      );
      expect(mockGetLogProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://whatever/third/party/logzio/endpoint/logs',
        config,
      );
    });
  });

  describe('custom endpoint with suffix', () => {
    it('should use custom endpoint with suffix when addSuffix is true', () => {
      const config = new RUMConfig(
        createConfig({
          tokens: { traces: 'trace-token', metrics: 'metrics-token', logs: 'logs-token' },
          endpoint: { url: 'https://custom.endpoint.com', addSuffix: true },
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
        config,
        expect.anything(), // AggregationTemporality
      );
      expect(mockGetLogProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://custom.endpoint.com/logs',
        config,
      );
    });

    it('should handle trailing slash in custom endpoint', () => {
      const config = new RUMConfig(
        createConfig({
          tokens: { traces: 'trace-token', metrics: 'metrics-token', logs: 'logs-token' },
          endpoint: { url: 'https://custom.endpoint.com/', addSuffix: true },
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
        config,
        expect.anything(), // AggregationTemporality
      );
      expect(mockGetLogProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://custom.endpoint.com/logs',
        config,
      );
    });
  });

  describe('custom endpoint without suffix', () => {
    it('should use custom endpoint as-is when addSuffix is false', () => {
      const config = new RUMConfig(
        createConfig({
          tokens: { traces: 'trace-token', metrics: 'metrics-token', logs: 'logs-token' },
          endpoint: { url: 'https://custom.endpoint.com/api/v1', addSuffix: false },
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
        config,
        expect.anything(), // AggregationTemporality
      );
      expect(mockGetLogProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://custom.endpoint.com/api/v1',
        config,
      );
    });
  });

  describe('invalid endpoint', () => {
    it('should throw an error when endpoint URL is invalid during config construction', () => {
      expect(() => {
        new RUMConfig(
          createConfig({
            tokens: { traces: 'trace-token', metrics: 'metrics-token', logs: 'logs-token' },
            endpoint: { url: 'invalid-url', addSuffix: true },
          }) as any,
        );
      }).toThrow('Invalid Endpoint URL "invalid-url".');
    });

    it('should throw an error when endpoint URL is empty during config construction', () => {
      expect(() => {
        new RUMConfig(
          createConfig({
            tokens: { traces: 'trace-token', metrics: 'metrics-token', logs: 'logs-token' },
            endpoint: { url: '', addSuffix: false },
          }) as any,
        );
      }).toThrow('Endpoint URL is required in RUM configuration.');
    });
  });
});
