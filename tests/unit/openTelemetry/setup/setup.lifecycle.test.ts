/**
 * Tests for OpenTelemetryProvider lifecycle methods
 */
import { createConfig } from '../../__utils__/configFactory';
import { createProviderInstance, resetProviderSingleton } from '../../__utils__/providerHelpers';
import {
  mockGetTraceProvider,
  mockGetMetricsProvider,
  mockGetLogProvider,
} from '../../__utils__/otelMocks';

describe('OpenTelemetryProvider Lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetProviderSingleton();
  });

  describe('forceFlush', () => {
    it('should call forceFlush on all available providers', () => {
      const config = createConfig({
        tokens: { traces: 'trace-token', metrics: 'metrics-token', logs: 'logs-token' },
      });
      const mockTraceProvider = { register: jest.fn(), forceFlush: jest.fn(), shutdown: jest.fn() };
      const mockMetricsProvider = { forceFlush: jest.fn(), shutdown: jest.fn() };
      const mockLogProvider = { forceFlush: jest.fn(), shutdown: jest.fn() };

      mockGetTraceProvider.mockReturnValue(mockTraceProvider);
      mockGetMetricsProvider.mockReturnValue(mockMetricsProvider);
      mockGetLogProvider.mockReturnValue(mockLogProvider);

      const provider = createProviderInstance(config);
      provider.forceFlush();

      expect(mockTraceProvider.forceFlush).toHaveBeenCalledTimes(1);
      expect(mockMetricsProvider.forceFlush).toHaveBeenCalledTimes(1);
      expect(mockLogProvider.forceFlush).toHaveBeenCalledTimes(1);
    });

    it('should not throw when some providers are null', () => {
      const config = createConfig({
        tokens: { traces: 'trace-token' }, // only traces
      });
      const mockTraceProvider = { register: jest.fn(), forceFlush: jest.fn(), shutdown: jest.fn() };
      mockGetTraceProvider.mockReturnValue(mockTraceProvider);

      const provider = createProviderInstance(config);

      expect(() => provider.forceFlush()).not.toThrow();
      expect(mockTraceProvider.forceFlush).toHaveBeenCalledTimes(1);
    });
  });

  describe('shutdown', () => {
    it('should call shutdown on all available providers and returns resolved promise', async () => {
      const config = createConfig({
        tokens: { traces: 'trace-token', metrics: 'metrics-token', logs: 'logs-token' },
      });
      const mockTraceProvider = {
        register: jest.fn(),
        forceFlush: jest.fn(),
        shutdown: jest.fn().mockResolvedValue(undefined),
      };
      const mockMetricsProvider = {
        forceFlush: jest.fn(),
        shutdown: jest.fn().mockResolvedValue(undefined),
      };
      const mockLogProvider = {
        forceFlush: jest.fn(),
        shutdown: jest.fn().mockResolvedValue(undefined),
      };

      mockGetTraceProvider.mockReturnValue(mockTraceProvider);
      mockGetMetricsProvider.mockReturnValue(mockMetricsProvider);
      mockGetLogProvider.mockReturnValue(mockLogProvider);

      const provider = createProviderInstance(config);
      const result = await provider.shutdown();

      expect(mockTraceProvider.shutdown).toHaveBeenCalledTimes(1);
      expect(mockMetricsProvider.shutdown).toHaveBeenCalledTimes(1);
      expect(mockLogProvider.shutdown).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });

    it('should not throw when some providers are null', async () => {
      const config = createConfig({
        tokens: { traces: 'trace-token' }, // only traces
      });
      const mockTraceProvider = {
        register: jest.fn(),
        forceFlush: jest.fn(),
        shutdown: jest.fn().mockResolvedValue(undefined),
      };
      mockGetTraceProvider.mockReturnValue(mockTraceProvider);

      const provider = createProviderInstance(config);
      const result = await provider.shutdown();

      expect(mockTraceProvider.shutdown).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });
  });

  describe('getMeterProvider', () => {
    it('should return metrics provider when it exists', () => {
      const config = createConfig({
        tokens: { traces: 'trace-token', metrics: 'metrics-token' },
      });
      const mockMetricsProvider = { forceFlush: jest.fn(), shutdown: jest.fn() };
      mockGetMetricsProvider.mockReturnValue(mockMetricsProvider);

      const provider = createProviderInstance(config);
      const result = provider.getMeterProvider();

      expect(result).toBe(mockMetricsProvider);
    });

    it('should return null when metrics provider does not exist', () => {
      const config = createConfig({
        tokens: { traces: 'trace-token' }, // no metrics token
      });

      const provider = createProviderInstance(config);
      const result = provider.getMeterProvider();

      expect(result).toBeNull();
    });
  });
});
