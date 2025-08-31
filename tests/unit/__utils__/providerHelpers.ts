/**
 * Helper functions for OpenTelemetryProvider testing
 */

/**
 * Creates a fresh OpenTelemetryProvider instance
 */
export function createProviderInstance(config: any) {
  const setupModule = require('@src/openTelemetry/setup');
  return setupModule.OpenTelemetryProvider.getInstance(config);
}

/**
 * Resets the OpenTelemetryProvider singleton by clearing module cache and instance
 */
export function resetProviderSingleton() {
  // Clear module cache to force fresh require
  delete require.cache[require.resolve('@src/openTelemetry/setup')];

  // Reset the static instance property if it exists
  const setupModule = require('@src/openTelemetry/setup');
  if (setupModule.OpenTelemetryProvider) {
    setupModule.OpenTelemetryProvider.instance = undefined;
  }
}

/**
 * Creates a fresh provider, runs callback, then cleans up
 */
export function withFreshProvider<T>(config: any, callback: (provider: any) => T): T {
  resetProviderSingleton();
  const provider = createProviderInstance(config);
  try {
    return callback(provider);
  } finally {
    // Optional: Add cleanup if needed
  }
}
