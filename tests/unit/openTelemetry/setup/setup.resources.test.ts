/**
 * Tests for OpenTelemetryProvider resource composition
 */
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { createConfig } from '../../__utils__/configFactory';
import { createProviderInstance, resetProviderSingleton } from '../../__utils__/providerHelpers';
import {
  expectServiceAttributes,
  expectLogzioAttributes,
  expectEnvironmentAttributes,
  expectMissingAttributes,
} from '../../__utils__/resourceHelpers';
import {
  mockGetTraceProvider,
  mockGetLogProvider,
  mockEnvironmentCollect,
} from '../../__utils__/otelMocks';

describe('OpenTelemetryProvider Resource Composition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetProviderSingleton();
  });

  describe('service attributes', () => {
    it('should include service name and version in resource', () => {
      const config = createConfig({
        service: { name: 'my-service', version: '2.1.0' },
        tokens: { traces: 'trace-token' },
      });
      createProviderInstance(config);

      expect(mockGetTraceProvider).toHaveBeenCalledTimes(1);
      const resourceArg = (mockGetTraceProvider as jest.Mock).mock.calls[0][0];
      expectServiceAttributes(resourceArg, 'my-service', '2.1.0');
    });

    it('should handle undefined service fields gracefully', () => {
      const config = createConfig({
        service: { name: 'test-service' },
      });

      expect(() => createProviderInstance(config)).not.toThrow();

      expect(mockGetTraceProvider).toHaveBeenCalledTimes(1);
      const resourceArg = (mockGetTraceProvider as jest.Mock).mock.calls[0][0];
      expectMissingAttributes(resourceArg, ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION);
    });
  });

  describe('logzio attributes', () => {
    it('should include logzio region and correct token for each data type', () => {
      const config = createConfig({
        region: 'eu-west-1',
        tokens: { traces: 'trace-123', logs: 'logs-789' },
      });
      createProviderInstance(config);

      expect(mockGetTraceProvider).toHaveBeenCalledTimes(1);
      expect(mockGetLogProvider).toHaveBeenCalledTimes(1);

      const traceResource = (mockGetTraceProvider as jest.Mock).mock.calls[0][0];
      const logsResource = (mockGetLogProvider as jest.Mock).mock.calls[0][0];

      expectLogzioAttributes(traceResource);
      expectLogzioAttributes(logsResource);
    });
  });

  describe('environment data', () => {
    it('should call EnvironmentCollector.collect with correct flags', () => {
      const config = createConfig({
        environmentData: {
          collectOS: false,
          collectBrowser: true,
          collectDevice: false,
          collectLanguage: true,
        },
      });
      createProviderInstance(config);

      expect(mockEnvironmentCollect).toHaveBeenCalledWith({
        collectOS: false,
        collectBrowser: true,
        collectDevice: false,
        collectLanguage: true,
      });
    });

    it('should include environment data in resource when non-empty', () => {
      const environmentData = {
        'browser.name': 'Chrome',
        'os.name': 'Windows',
      };
      mockEnvironmentCollect.mockReturnValue(environmentData);

      const config = createConfig();
      createProviderInstance(config);

      expect(mockGetTraceProvider).toHaveBeenCalledTimes(1);
      const resourceArg = (mockGetTraceProvider as jest.Mock).mock.calls[0][0];
      expectEnvironmentAttributes(resourceArg, environmentData);
    });

    it('should exclude environment data from resource when empty', () => {
      mockEnvironmentCollect.mockReturnValue({});

      const config = createConfig();
      createProviderInstance(config);

      expect(mockGetTraceProvider).toHaveBeenCalledTimes(1);
      const resourceArg = (mockGetTraceProvider as jest.Mock).mock.calls[0][0];
      expectMissingAttributes(resourceArg, 'browser.name', 'os.name');
    });
  });
});
