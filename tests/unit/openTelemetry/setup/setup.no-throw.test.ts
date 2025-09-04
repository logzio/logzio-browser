/**
 * Tests for OpenTelemetryProvider no-throw policy
 */
import '../../__utils__/otelMocks';
import { createConfig } from '../../__utils__/configFactory';
import { createProviderInstance, resetProviderSingleton } from '../../__utils__/providerHelpers';
import { OpenTelemetryProvider } from '@src/openTelemetry/setup';

describe('OpenTelemetryProvider No-Throw Policy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetProviderSingleton();
  });

  it('registerProviders should not throw with minimal config', () => {
    const config = createConfig();
    const provider = createProviderInstance(config);

    expect(() => provider.registerProviders()).not.toThrow();
  });

  it('registerInstrumentations should not throw with minimal config', () => {
    const config = createConfig();
    const mockNavigationTracker = { init: jest.fn() };
    const provider = createProviderInstance(config);

    expect(() => provider.registerInstrumentations(mockNavigationTracker)).not.toThrow();
  });

  it('forceFlush should not throw with minimal config', () => {
    const config = createConfig();
    const provider = createProviderInstance(config);

    expect(() => provider.forceFlush()).not.toThrow();
  });

  it('shutdown should not throw with minimal config', async () => {
    const config = createConfig();
    createProviderInstance(config);

    await expect(OpenTelemetryProvider.shutdown()).resolves.toBeUndefined();
  });
});
