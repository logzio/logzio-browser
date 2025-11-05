/**
 * Tests for OpenTelemetryProvider provider registration
 */
import { createConfig } from '../../__utils__/configFactory';
import { createProviderInstance, resetProviderSingleton } from '../../__utils__/providerHelpers';
import {
  mockGetTraceProvider,
  mockGetLogProvider,
  mockGetContextManagerInstance,
  mockSetGlobalLoggerProvider,
} from '../../__utils__/otelMocks';

describe('OpenTelemetryProvider Registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetProviderSingleton();
  });

  describe('context manager registration', () => {
    it('should register context manager with correct sequence', () => {
      const config = createConfig({
        customAttributes: { 'custom.attr': 'value' },
      });
      const mockContextManager = {
        setInitialCustomAttributes: jest.fn(),
        enable: jest.fn(),
      };
      mockGetContextManagerInstance.mockReturnValue(mockContextManager);

      const provider = createProviderInstance(config);
      provider.registerProviders();

      expect(mockGetContextManagerInstance).toHaveBeenCalledTimes(1);
      expect(mockContextManager.setInitialCustomAttributes).toHaveBeenCalledWith({
        'custom.attr': 'value',
      });
      expect(mockContextManager.enable).toHaveBeenCalledTimes(1);
      // Get the mock instance that was actually used
      expect(mockGetTraceProvider).toHaveBeenCalled();
      const traceProviderMock = mockGetTraceProvider.mock.results[0].value;
      expect(traceProviderMock.register).toHaveBeenCalledWith({
        contextManager: mockContextManager,
      });
    });
  });

  describe('trace provider registration', () => {
    it('should register trace provider', () => {
      const config = createConfig();
      const mockTraceProvider = { register: jest.fn(), forceFlush: jest.fn(), shutdown: jest.fn() };
      mockGetTraceProvider.mockReturnValue(mockTraceProvider);

      const provider = createProviderInstance(config);
      provider.registerProviders();

      expect(mockTraceProvider.register).toHaveBeenCalledTimes(1);
    });
  });

  describe('global provider registration', () => {
    it('should set global logger provider only when log provider exists', () => {
      const config = createConfig({
        tokens: { traces: 'trace-token', logs: 'logs-token' },
      });
      const mockLogProvider = { forceFlush: jest.fn(), shutdown: jest.fn() };
      mockGetLogProvider.mockReturnValue(mockLogProvider);

      const provider = createProviderInstance(config);
      provider.registerProviders();

      expect(mockSetGlobalLoggerProvider).toHaveBeenCalledWith(mockLogProvider);
    });

    it('should not set global logger provider when log provider does not exist', () => {
      const config = createConfig({
        tokens: { traces: 'trace-token' },
      });

      const provider = createProviderInstance(config);
      provider.registerProviders();

      expect(mockSetGlobalLoggerProvider).not.toHaveBeenCalled();
    });
  });
});
