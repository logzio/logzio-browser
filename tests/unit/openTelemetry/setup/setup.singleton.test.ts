/**
 * Tests for OpenTelemetryProvider singleton behavior
 */
import '../../__utils__/otelMocks';
import { createConfig } from '../../__utils__/configFactory';
import { createProviderInstance, resetProviderSingleton } from '../../__utils__/providerHelpers';

describe('OpenTelemetryProvider Singleton Behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetProviderSingleton();
  });

  it('getInstance should return same instance on consecutive calls', () => {
    const config = createConfig();

    const instance1 = createProviderInstance(config);
    const instance2 = createProviderInstance(config);

    expect(instance1).toBe(instance2);
  });

  it('should create new instance after module reset', () => {
    const config = createConfig();

    const instance1 = createProviderInstance(config);

    // Reset singleton to get fresh instance
    resetProviderSingleton();

    const instance2 = createProviderInstance(config);

    expect(instance1).not.toBe(instance2);
  });
});
