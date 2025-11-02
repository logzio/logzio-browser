/**
 * Tests for OpenTelemetryProvider construction and endpoint handling
 */
import { createConfig } from '../../__utils__/configFactory';
import { createProviderInstance, resetProviderSingleton } from '../../__utils__/providerHelpers';
import {
  mockGetTraceProvider,
  mockGetMetricsProvider,
  mockGetLogProvider,
} from '../../__utils__/otelMocks';

describe('OpenTelemetryProvider Construction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetProviderSingleton();
  });

  describe('provider creation', () => {
    it('should create only trace provider when only traces token provided', () => {
      const config = createConfig({
        tokens: { traces: 'trace-token' },
      });
      createProviderInstance(config);

      expect(mockGetTraceProvider).toHaveBeenCalledTimes(1);
      expect(mockGetMetricsProvider).not.toHaveBeenCalled();
      expect(mockGetLogProvider).not.toHaveBeenCalled();
    });

    it('should create trace and metrics providers when both tokens provided', () => {
      const config = createConfig({
        tokens: { traces: 'trace-token', metrics: 'metrics-token' },
      });
      createProviderInstance(config);

      expect(mockGetTraceProvider).toHaveBeenCalledTimes(1);
      // Metrics provider is called twice: once for DELTA, once for CUMULATIVE
      expect(mockGetMetricsProvider).toHaveBeenCalledTimes(2);
      expect(mockGetLogProvider).not.toHaveBeenCalled();
    });

    it('should create trace and log providers when both tokens provided', () => {
      const config = createConfig({
        tokens: { traces: 'trace-token', logs: 'logs-token' },
      });
      createProviderInstance(config);

      expect(mockGetTraceProvider).toHaveBeenCalledTimes(1);
      expect(mockGetMetricsProvider).not.toHaveBeenCalled();
      expect(mockGetLogProvider).toHaveBeenCalledTimes(1);
    });

    it('should create all providers when all tokens provided', () => {
      const config = createConfig({
        tokens: { traces: 'trace-token', metrics: 'metrics-token', logs: 'logs-token' },
      });
      createProviderInstance(config);

      expect(mockGetTraceProvider).toHaveBeenCalledTimes(1);
      // Metrics provider is called twice: once for DELTA, once for CUMULATIVE
      expect(mockGetMetricsProvider).toHaveBeenCalledTimes(2);
      expect(mockGetLogProvider).toHaveBeenCalledTimes(1);
    });
  });

  describe('endpoint handling', () => {
    it('should pass correct endpoints to provider functions', () => {
      const config = createConfig({
        tokens: { traces: 'trace-token', metrics: 'metrics-token', logs: 'logs-token' },
      });
      createProviderInstance(config);

      expect(mockGetTraceProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://whatever/third/party/logzio/endpoint/traces',
        config,
      );
      expect(mockGetMetricsProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://whatever/third/party/logzio/endpoint/metrics',
        config,
        expect.anything(), // AggregationTemporality
      );
      expect(mockGetLogProvider).toHaveBeenCalledWith(
        expect.anything(),
        'https://whatever/third/party/logzio/endpoint/logs',
        config,
      );
    });
  });
});
