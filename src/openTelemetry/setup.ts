import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { Instrumentation, registerInstrumentations } from '@opentelemetry/instrumentation';
import type { Resource } from '@opentelemetry/resources';
import { emptyResource, resourceFromAttributes } from '@opentelemetry/resources';
import { LoggerProvider } from '@opentelemetry/sdk-logs';
import { context } from '@opentelemetry/api';
import { logs } from '@opentelemetry/api-logs';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { ExceptionInstrumentation } from '@opentelemetry/instrumentation-web-exception';
import { RUMConfig } from '../config';
import {
  ExceptionHelper,
  LogzioUserInteractionInstrumentation,
  ConsoleLogsInstrumentation,
} from '../instrumentation';
import { LogzioContextManager } from '../context/LogzioContextManager';
import { EnvironmentCollector, EnvironmentAttributes } from '../utils';
import { rumLogger, SessionManager } from '../shared';
import { getLogProvider, getTraceProvider } from './providers';

const enum DataType {
  LOGS = 'logs',
  TRACES = 'traces',
}

/**
 * This class represents the OpenTelemetry provider.
 * It sets up the OpenTelemetry providers and instrumentations.
 */
export class OpenTelemetryProvider {
  private static instance: OpenTelemetryProvider | null = null;

  private traceProvider: WebTracerProvider;
  private logProvider: LoggerProvider | null = null;
  private envData: EnvironmentAttributes = {};

  private constructor(private readonly config: RUMConfig) {
    this.envData = this.collectEnvDataSafe();

    this.traceProvider = this.getTraceProvider();
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
    let baseEndpoint = this.config.endpoint.url;
    baseEndpoint = baseEndpoint.replace(/\/$/, '');
    return this.config.endpoint.addSuffix ? `${baseEndpoint}/${dataType}` : baseEndpoint;
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
   */
  public registerInstrumentations(): void {
    rumLogger.debug('Registering OpenTelemetry instrumentations');
    registerInstrumentations({
      instrumentations: this.getInstrumentations(),
    });
  }

  /**
   * Shuts down the providers gracefully.
   */
  public static async shutdown(): Promise<void> {
    const op = OpenTelemetryProvider.instance;

    if (op) {
      try {
        // Force flush before shutdown
        op.forceFlush();

        // Shutdown all providers
        const promises: Promise<unknown>[] = [];
        if (op.traceProvider) promises.push(op.traceProvider.shutdown());
        if (op.logProvider) promises.push(op.logProvider.shutdown());

        await Promise.all(promises);
      } finally {
        // Always reset the singleton, even if shutdown fails
        OpenTelemetryProvider.instance = null;
      }
    }
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
    if (this.logProvider) this.logProvider.forceFlush();
  }

  /**
   * Returns a trace provider.
   * @returns The trace provider.
   */
  private getTraceProvider(): WebTracerProvider {
    return getTraceProvider(this.getResource(), this.getEndpointUrl(DataType.TRACES), this.config);
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
   * @returns The resource.
   */
  private getResource(): Resource {
    let resource: Resource = emptyResource();

    if (this.config.service?.name) {
      resource = resource.merge(
        resourceFromAttributes({
          [ATTR_SERVICE_NAME]: this.config.service.name,
        }),
      );
    }

    if (this.config.service?.version) {
      resource = resource.merge(
        resourceFromAttributes({
          [ATTR_SERVICE_VERSION]: this.config.service.version,
        }),
      );
    }

    const environmentData = this.envData;

    if (Object.keys(environmentData).length > 0) {
      resource = resource.merge(resourceFromAttributes(environmentData));
    }

    return resource;
  }

  /**
   * Returns the instrumentations.
   * @returns The instrumentations.
   */
  private getInstrumentations(): Instrumentation[] {
    const instrumentations: Instrumentation[] = [];

    if (this.config.enable?.userActions) {
      rumLogger.debug('Registering user actions instrumentation');
      instrumentations.push(
        new LogzioUserInteractionInstrumentation({
          frustrationThresholds: this.config.frustrationThresholds,
          trackNavigation: this.config.enable.navigation,
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
      instrumentations.push(
        new ExceptionInstrumentation({
          applyCustomAttributes: (error) => ExceptionHelper.getCustomAttributes(error),
        }),
      );
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
}
