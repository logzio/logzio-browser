/**
 * Mock for MetricsProviderManager to avoid timer.unref issues in Jest
 */

export class MockMetricsProviderManager {
  private mockMeter: any;
  private mockDeltaProvider: any;

  init(resource: any, endpoint: string, config: any) {
    // Call getMetricsProvider if it exists (allows tests to spy on the calls)
    try {
      // Import from the providers module (which may be mocked by tests)
      const providersModule = jest.requireMock('@src/openTelemetry/providers');
      const { AggregationTemporality } = jest.requireActual('@opentelemetry/sdk-metrics');

      if (providersModule && providersModule.getMetricsProvider) {
        // Call getMetricsProvider for both DELTA and CUMULATIVE
        // Tests can spy on these calls
        this.mockDeltaProvider = providersModule.getMetricsProvider(
          resource,
          endpoint,
          config,
          AggregationTemporality.DELTA,
        );
        // Also create CUMULATIVE provider (the call is important for test spies)
        providersModule.getMetricsProvider(
          resource,
          endpoint,
          config,
          AggregationTemporality.CUMULATIVE,
        );
      } else {
        this.mockDeltaProvider = { forceFlush: jest.fn(), shutdown: jest.fn() };
      }
    } catch (error) {
      // If anything fails, just create a mock provider
      this.mockDeltaProvider = { forceFlush: jest.fn(), shutdown: jest.fn() };
    }
  }

  getDeltaProvider() {
    return this.mockDeltaProvider || { forceFlush: jest.fn(), shutdown: jest.fn() };
  }

  getMeter(_name: string, _version?: string) {
    if (!this.mockMeter) {
      this.mockMeter = {
        createCounter: jest.fn().mockReturnValue({
          add: jest.fn(),
        }),
        createHistogram: jest.fn().mockReturnValue({
          record: jest.fn(),
        }),
      };
    }
    return this.mockMeter;
  }

  // Deprecated alias for backward compatibility
  getCumulativeMeter(name: string, version?: string) {
    return this.getMeter(name, version);
  }

  async shutdown() {
    // Call shutdown on the delta provider if it exists (for test spies)
    if (this.mockDeltaProvider && typeof this.mockDeltaProvider.shutdown === 'function') {
      await this.mockDeltaProvider.shutdown();
    }
  }

  async forceFlush() {
    // Call forceFlush on the delta provider if it exists (for test spies)
    if (this.mockDeltaProvider && typeof this.mockDeltaProvider.forceFlush === 'function') {
      await this.mockDeltaProvider.forceFlush();
    }
  }
}

export const mockMetricsProviderManager = new MockMetricsProviderManager();
