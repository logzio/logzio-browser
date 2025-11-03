import { MeterProvider, AggregationTemporality } from '@opentelemetry/sdk-metrics';
import { Meter } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import { RUMConfig } from '../config';
import { rumLogger } from '../shared/Logger';
import { getMetricsProvider } from './providers/metrics';

/**
 * Manages OpenTelemetry metric providers with different aggregation temporalities.
 * - DELTA provider (global): for one-time metrics like web vitals, frustration, errors.
 * - CUMULATIVE provider (non-global): for ongoing counters like sessions and views.
 */
export class MetricsProviderManager {
  private deltaProvider: MeterProvider | null = null;
  private cumulativeProvider: MeterProvider | null = null;
  private isInitialized = false;

  /**
   * Initializes both DELTA and CUMULATIVE metric providers.
   * @param resource - The resource for the metric providers.
   * @param endpoint - The endpoint to export the metrics to.
   * @param config - The configuration for the SDK.
   */
  init(resource: Resource, endpoint: string, config: RUMConfig): void {
    if (this.isInitialized) {
      rumLogger.warn('MetricsProviderManager already initialized');
      return;
    }

    try {
      // DELTA provider for web vitals, frustration, errors (will be set as global)
      this.deltaProvider = getMetricsProvider(
        resource,
        endpoint,
        config,
        AggregationTemporality.DELTA,
      );

      // CUMULATIVE provider for sessions/views counters (non-global)
      this.cumulativeProvider = getMetricsProvider(
        resource,
        endpoint,
        config,
        AggregationTemporality.CUMULATIVE,
      );

      this.isInitialized = true;
      rumLogger.debug('MetricsProviderManager initialized with DELTA and CUMULATIVE providers');
    } catch (error) {
      rumLogger.error('Failed to initialize MetricsProviderManager:', error);
      throw error;
    }
  }

  /**
   * Returns the DELTA meter provider (for web vitals, frustration, errors).
   * This provider will be set as the global meter provider.
   */
  getDeltaProvider(): MeterProvider | null {
    return this.deltaProvider;
  }

  /**
   * Returns a meter from the CUMULATIVE provider for ongoing counters.
   * This is a convenience method similar to OpenTelemetry's metrics.getMeter().
   * @param name - The name of the meter.
   * @param version - The version of the meter.
   * @returns Meter instance from the CUMULATIVE provider.
   */
  getMeter(name: string, version?: string): Meter | null {
    if (!this.cumulativeProvider) {
      rumLogger.warn('CUMULATIVE provider not initialized, cannot get meter');
      return null;
    }
    return this.cumulativeProvider.getMeter(name, version);
  }

  /**
   * @deprecated Use getMeter() instead. This method will be removed in a future version.
   */
  getCumulativeMeter(name: string, version?: string): Meter | null {
    return this.getMeter(name, version);
  }

  /**
   * Shuts down both metric providers.
   * Must not throw per no-throw policy.
   */
  async shutdown(): Promise<void> {
    const shutdownPromises: Promise<void>[] = [];

    if (this.deltaProvider) {
      shutdownPromises.push(
        this.deltaProvider.shutdown().catch((error) => {
          rumLogger.error('Failed to shutdown DELTA provider:', error);
        }),
      );
    }

    if (this.cumulativeProvider) {
      shutdownPromises.push(
        this.cumulativeProvider.shutdown().catch((error) => {
          rumLogger.error('Failed to shutdown CUMULATIVE provider:', error);
        }),
      );
    }

    await Promise.all(shutdownPromises);
    this.isInitialized = false;
    rumLogger.debug('MetricsProviderManager shutdown complete');
  }

  /**
   * Force flushes both metric providers.
   * Must not throw per no-throw policy.
   */
  async forceFlush(): Promise<void> {
    const flushPromises: Promise<void>[] = [];

    if (this.deltaProvider) {
      flushPromises.push(
        this.deltaProvider.forceFlush().catch((error) => {
          rumLogger.error('Failed to force flush DELTA provider:', error);
        }),
      );
    }

    if (this.cumulativeProvider) {
      flushPromises.push(
        this.cumulativeProvider.forceFlush().catch((error) => {
          rumLogger.error('Failed to force flush CUMULATIVE provider:', error);
        }),
      );
    }

    await Promise.all(flushPromises);
  }
}

// Singleton instance
export const metricsProviderManager = new MetricsProviderManager();
