import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { Instrumentation, registerInstrumentations } from '@opentelemetry/instrumentation';
import type { Resource } from '@opentelemetry/resources';
import { emptyResource, resourceFromAttributes } from '@opentelemetry/resources';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { LoggerProvider } from '@opentelemetry/sdk-logs';
import { context, metrics } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { RUMConfig } from '../config';
import {
  ErrorTrackingInstrumentation,
  LogzioUserInteractionInstrumentation,
  ConsoleLogsInstrumentation,
} from '../instrumentation';
import { NavigationTracker } from '../instrumentation/trackers';
import { LogzioContextManager } from '../context/LogzioContextManager';
import { EnvironmentCollector, EnvironmentAttributes } from '../utils';
import { rumLogger, SessionManager } from '../shared';
import { stringifyDefined } from '../utils/helpers';
import { getMetricsProvider, getLogProvider, getTraceProvider } from './providers';

const enum DataType {
  LOGS = 'logs',
  METRICS = 'metrics',
  TRACES = 'traces',
}

/**
 * This class represents the OpenTelemetry provider.
 * It sets up the OpenTelemetry providers and instrumentations.
 */
export class OpenTelemetryProvider {
  private static readonly ENDPOINT = 'https://whatever/third/party/logzio/endpoint';

  private static instance: OpenTelemetryProvider;

  private traceProvider: WebTracerProvider;
  private metricsProvider: MeterProvider | null = null;
  private logProvider: LoggerProvider | null = null;
  private envData: EnvironmentAttributes = {};

  private constructor(private readonly config: RUMConfig) {
    this.envData = this.collectEnvDataSafe();

    this.traceProvider = this.getTraceProvider();
    if (config.tokens.metrics) this.metricsProvider = this.getMetricsProvider();
    if (config.tokens.logs) this.logProvider = this.getLogProvider();
  }

  /**
   * Implements the singleton pattern.
   * @param config - The RUM configuration.
   */
  public static getInstance(config: RUMConfig): OpenTelemetryProvider {
    if (!OpenTelemetryProvider.instance)
      OpenTelemetryProvider.instance = new OpenTelemetryProvider(config);
    return OpenTelemetryProvider.instance;
  }

  /**
   * Resolves the endpoint URL for a specific data type.
   * @param dataType - The data type (traces, metrics, logs).
   * @returns The resolved endpoint URL.
   */
  private getEndpointUrl(dataType: DataType): string {
    let baseEndpoint = OpenTelemetryProvider.ENDPOINT;

    // Use custom endpoint if provided and valid
    if (this.config.customEndpoint!.url) {
      try {
        new URL(this.config.customEndpoint!.url);
        baseEndpoint = this.config.customEndpoint!.url;
        baseEndpoint = baseEndpoint.replace(/\/$/, '');
        return this.config.customEndpoint!.addSuffix ? `${baseEndpoint}/${dataType}` : baseEndpoint;
      } catch (_error) {
        rumLogger.warn(
          `Invalid custom endpoint URL "${this.config.customEndpoint!.url}". Falling back to default endpoint.`,
        );
      }
    }

    return `${baseEndpoint}/${dataType}`;
  }

  /**
   * Registers the providers.
   */
  public registerProviders(): void {
    rumLogger.debug('Registering OpenTelemetry providers');
    const contextManager = this.setupContextManager();

    // Register trace provider with our context manager to prevent it from being overridden
    this.traceProvider.register({
      contextManager: contextManager,
    });

    if (this.metricsProvider) metrics.setGlobalMeterProvider(this.metricsProvider);
    if (this.logProvider) logs.setGlobalLoggerProvider(this.logProvider);
  }

  private setupContextManager(): LogzioContextManager {
    const contextManager = LogzioContextManager.getInstance();
    contextManager.setInitialCustomAttributes(this.config.customAttributes);
    contextManager.enable();
    context.setGlobalContextManager(contextManager);
    return contextManager;
  }

  /**
   * Registers the instrumentations.
   * @param navigationTracker - The navigation tracker.
   */
  public registerInstrumentations(navigationTracker: NavigationTracker): void {
    rumLogger.debug('Registering OpenTelemetry instrumentations');
    navigationTracker.init();

    registerInstrumentations({
      instrumentations: this.getInstrumentations(navigationTracker),
    });
  }

  /**
   * Shuts down the providers gracefully.
   */
  public shutdown(): Promise<void> {
    const promises: Promise<unknown>[] = [];
    if (this.traceProvider) promises.push(this.traceProvider.shutdown());
    if (this.metricsProvider) promises.push(this.metricsProvider.shutdown());
    if (this.logProvider) promises.push(this.logProvider.shutdown());

    return Promise.all(promises).then(() => {});
  }

  /**
   * Wires the session manager to the processors after it's created.
   * This allows processors to access live session/view data.
   */
  public setSessionManager(sessionManager: SessionManager): void {
    try {
      // Wire session manager to span processors
      const spanProcessors = (this.traceProvider as any)._config?.spanProcessors || [];
      spanProcessors.forEach((processor: any) => {
        if (processor && typeof processor.setSessionManager === 'function') {
          processor.setSessionManager(sessionManager);
        }
      });

      // Wire session manager to log processors
      const logProcessors = (this.logProvider as any)?._config?.processors || [];
      logProcessors.forEach((processor: any) => {
        if (processor && typeof processor.setSessionManager === 'function') {
          processor.setSessionManager(sessionManager);
        }
      });
    } catch (error) {
      rumLogger.warn('Failed to wire session manager to processors:', error);
    }
  }

  /**
   * Forces a flush of the data.
   */
  public forceFlush(): void {
    if (this.traceProvider) this.traceProvider.forceFlush();
    if (this.metricsProvider) this.metricsProvider.forceFlush();
    if (this.logProvider) this.logProvider.forceFlush();
  }

  /**
   * Returns the meter provider.
   * @returns The meter provider.
   */
  public getMeterProvider(): MeterProvider | null {
    return this.metricsProvider;
  }

  /**
   * Returns a trace provider.
   * @returns The trace provider.
   */
  private getTraceProvider(): WebTracerProvider {
    return getTraceProvider(this.getResource(), this.getEndpointUrl(DataType.TRACES), this.config);
  }

  /**
   * Returns a metrics provider.
   * @returns The metrics provider.
   */
  private getMetricsProvider(): MeterProvider {
    return getMetricsProvider(
      this.getResource(true),
      this.getEndpointUrl(DataType.METRICS),
      this.config,
    );
  }

  /**
   * Returns a log provider.
   * @returns The log provider.
   */
  private getLogProvider(): LoggerProvider {
    return getLogProvider(this.getResource(), this.getEndpointUrl(DataType.LOGS), this.config);
  }

  /**
   * Returns a resource.
   * @param isMetrics - Whether this resource is for metrics (defaults to false).
   * @returns The resource.
   */
  private getResource(isMetrics = false): Resource {
    let resource: Resource = emptyResource();

    if (this.config.service?.name)
      resource = resource.merge(
        resourceFromAttributes({
          [ATTR_SERVICE_NAME]: this.config.service!.name,
        }),
      );

    if (this.config.service?.version)
      resource = resource.merge(
        resourceFromAttributes({
          [ATTR_SERVICE_VERSION]: this.config.service!.version,
        }),
      );

    const environmentData = this.getEnvDataForResource(isMetrics);

    if (Object.keys(environmentData).length > 0) {
      resource = resource.merge(resourceFromAttributes(environmentData));
    }

    return resource;
  }

  /**
   * Returns the instrumentations.
   * @returns The instrumentations.
   */
  private getInstrumentations(navigationTracker: NavigationTracker): Instrumentation[] {
    const instrumentations: Instrumentation[] = [];

    if (this.config.enable?.userActions) {
      rumLogger.debug('Registering user actions instrumentation');
      instrumentations.push(
        new LogzioUserInteractionInstrumentation({
          frustrationThresholds: this.config.frustrationThresholds,
          navigationTracker: navigationTracker,
        }),
      );
    }
    if (this.config.enable?.documentLoad) {
      rumLogger.debug('Registering document load instrumentation');
      instrumentations.push(new DocumentLoadInstrumentation());
    }
    if (this.config.enable?.resourceLoad) {
      rumLogger.debug('Registering resource load instrumentation');
      const networkConfig =
        this.config.propagateTraceHeaderCorsUrls.length > 0
          ? { propagateTraceHeaderCorsUrls: this.config.propagateTraceHeaderCorsUrls }
          : {};

      instrumentations.push(new FetchInstrumentation(networkConfig));
      instrumentations.push(new XMLHttpRequestInstrumentation(networkConfig));
    }
    if (this.config.enable?.errorTracking) {
      rumLogger.debug('Registering error tracking instrumentation');
      instrumentations.push(new ErrorTrackingInstrumentation({}));
    }

    if (this.config.enable?.consoleLogs) {
      rumLogger.debug('Registering console logs instrumentation');
      instrumentations.push(new ConsoleLogsInstrumentation({}));
    }

    return instrumentations;
  }

  /**
   * Safely collects environment data with error handling.
   */
  private collectEnvDataSafe(): EnvironmentAttributes {
    try {
      return EnvironmentCollector.collect({
        collectOS: this.config.environmentData!.collectOS,
        collectBrowser: this.config.environmentData!.collectBrowser,
        collectDevice: this.config.environmentData!.collectDevice,
        collectLanguage: this.config.environmentData!.collectLanguage,
      });
    } catch (error) {
      rumLogger.error('Failed to collect environment data during setup', error);
      return {};
    }
  }

  /**
   * Returns environment data for resource creation.
   * For metrics, stringifies all values. For traces/logs, returns original types.
   */
  private getEnvDataForResource(
    isMetrics = false,
  ): Record<string, string | number> | Record<string, string> {
    if (!isMetrics) {
      return this.envData;
    }
    return stringifyDefined(this.envData);
  }
}
