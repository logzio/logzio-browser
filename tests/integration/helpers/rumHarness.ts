import { LogzioRUM } from '../../../src';
import { RUMConfigOptions } from '../../../src/config/types';
import { createConfig } from '../../unit/__utils__/configFactory';
import { resetProviderSingleton } from '../../unit/__utils__/providerHelpers';

export function startRUM(collectorPort: number, overrides: Partial<RUMConfigOptions> = {}): void {
  const testConfig = createConfig({
    tokens: {
      traces: 'test-traces-token',
      // metrics: 'test-metrics-token', // Disabled in jsdom to avoid OTEL metrics init
      logs: 'test-logs-token',
    },
    customEndpoint: {
      url: `http://127.0.0.1:${collectorPort}`,
      addSuffix: true,
    },
    enable: {
      userActions: true,
      documentLoad: true,
      resourceLoad: true,
      consoleLogs: true,
      errorTracking: true,
      navigation: true,
      // Disabled metrics-dependent features due to JSDOM timer.unref compatibility issue
      webVitals: false,
      viewEvents: false,
      frustrationDetection: false,
    },
    environmentData: {
      collectOS: true,
      collectBrowser: true,
      collectDevice: true,
      collectLanguage: true,
    },
    frustrationThresholds: {
      heavyLoadThresholdMs: 1500,
    },
    samplingRate: 100, // Always sample in tests
  });

  // Merge with override configuration
  const finalConfig = {
    ...testConfig,
    ...overrides,
    // Handle nested objects properly
    tokens: { ...testConfig.tokens, ...overrides.tokens },
    enable: {
      ...testConfig.enable,
      ...overrides.enable,
    },
    environmentData: { ...testConfig.environmentData, ...overrides.environmentData },
    frustrationThresholds: {
      ...testConfig.frustrationThresholds,
      ...overrides.frustrationThresholds,
    },
    customEndpoint: { ...testConfig.customEndpoint, ...overrides.customEndpoint },
  } as RUMConfigOptions;

  LogzioRUM.init(finalConfig);
}

export function stopRUM(): void {
  try {
    LogzioRUM.shutdown();
  } catch (_error) {
    // Ignore shutdown errors in tests
  }

  resetProviderSingleton();
}

export function forceFlush(): void {
  try {
    // Trigger visibility change to force flush
    Object.defineProperty(document, 'hidden', {
      writable: true,
      configurable: true,
      value: true,
    });

    document.dispatchEvent(new Event('visibilitychange'));

    // Reset visibility
    setTimeout(() => {
      Object.defineProperty(document, 'hidden', {
        writable: true,
        configurable: true,
        value: false,
      });
    }, 100);
  } catch (_error) {
    // Ignore flush errors in tests
  }
}
