/**
 * Tests for OpenTelemetryProvider lifecycle methods
 */
import { createConfig } from '../../__utils__/configFactory';
import { createProviderInstance, resetProviderSingleton } from '../../__utils__/providerHelpers';
import { mockGetTraceProvider, mockGetLogProvider } from '../../__utils__/otelMocks';
import { OpenTelemetryProvider } from '@src/openTelemetry/setup';

describe('OpenTelemetryProvider Lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetProviderSingleton();
  });

  describe('forceFlush', () => {
    it('should call forceFlush on all available providers', () => {
      const config = createConfig({
        tokens: { traces: 'trace-token', logs: 'logs-token' },
      });
      const mockTraceProvider = { register: jest.fn(), forceFlush: jest.fn(), shutdown: jest.fn() };
      const mockLogProvider = { forceFlush: jest.fn(), shutdown: jest.fn() };

      mockGetTraceProvider.mockReturnValue(mockTraceProvider);
      mockGetLogProvider.mockReturnValue(mockLogProvider);

      const provider = createProviderInstance(config);
      provider.forceFlush();

      expect(mockTraceProvider.forceFlush).toHaveBeenCalledTimes(1);
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
        tokens: { traces: 'trace-token', logs: 'logs-token' },
      });
      const mockTraceProvider = {
        register: jest.fn(),
        forceFlush: jest.fn(),
        shutdown: jest.fn().mockResolvedValue(undefined),
      };
      const mockLogProvider = {
        forceFlush: jest.fn(),
        shutdown: jest.fn().mockResolvedValue(undefined),
      };

      mockGetTraceProvider.mockReturnValue(mockTraceProvider);
      mockGetLogProvider.mockReturnValue(mockLogProvider);

      createProviderInstance(config);
      const result = await OpenTelemetryProvider.shutdown();

      expect(mockTraceProvider.shutdown).toHaveBeenCalledTimes(1);
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

      createProviderInstance(config);
      const result = await OpenTelemetryProvider.shutdown();

      expect(mockTraceProvider.shutdown).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });
  });
});
