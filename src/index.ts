import { RUMConfig } from './config';
import { RUMConfigOptions } from './config/types';
import { RUMSessionManager } from './context/RUMSessionManager';
import { LogzioContextManager } from './context/LogzioContextManager';
import { rumLogger } from './shared';
import { OpenTelemetryProvider } from './openTelemetry/setup';
import { NavigationTracker } from './instrumentation/trackers';

/**
 * This class represents the Logzio RUM SDK.
 * It initializes the RUM SDK and provides methods to get the configuration and shutdown the SDK.
 */
export class LogzioRUM {
  private static session: RUMSessionManager | null = null;
  private static instance: LogzioRUM | null = null;

  private constructor(private readonly config: RUMConfig) {}

  /**
   * Initializes and starts the Logzio RUM SDK.
   * @param config - The configuration for the RUM SDK.
   */
  public static init(config: Partial<RUMConfigOptions>): void {
    try {
      const sdk = new LogzioRUM(new RUMConfig(config));
      LogzioRUM.instance = sdk;
      sdk.start();
    } catch (error) {
      rumLogger.error('Failed to initialize LogzioRUM due to error: ', error);
    }
  }

  /**
   * Starts the Logzio RUM SDK and registers the instrumentations.
   */
  private start(): void {
    try {
      this.initComponents();
      rumLogger.debug('Initializing LogzioRUM');
      const openTelemetryProvider = OpenTelemetryProvider.getInstance(this.config);
      openTelemetryProvider.registerProviders();
      this.startSession(openTelemetryProvider);
      openTelemetryProvider.registerInstrumentations(NavigationTracker.getInstance());
      rumLogger.info('LogzioRUM initialized');
    } catch (error) {
      rumLogger.error('Failed to start LogzioRUM due to error: ', error);
    }
  }

  private initComponents(): void {
    rumLogger.setLevel(this.config.logLevel);
    NavigationTracker.getInstance().init();
  }

  /**
   * Starts the session and wires the session manager to the opentelemetry processors.
   */
  private startSession(openTelemetryProvider: OpenTelemetryProvider): void {
    LogzioRUM.session = new RUMSessionManager(this.config);
    LogzioRUM.session.start(NavigationTracker.getInstance());
    openTelemetryProvider.setSessionManager(LogzioRUM.session);
  }

  /**
   * Returns the configuration for the RUM SDK.
   * @returns The configuration for the RUM SDK.
   */
  public getConfig(): RUMConfig {
    return this.config;
  }

  /**
   * Gets a copy of the current custom attributes.
   * @returns The current custom attributes or undefined if not initialized.
   */
  public static getAttributes(): Record<string, any> | undefined {
    if (!LogzioRUM.instance) return undefined;

    const contextManager = LogzioContextManager.getInstance();
    return contextManager.getCurrentCustomAttributes();
  }

  /**
   * Sets custom attributes that will be applied to all future spans and logs.
   * Replaces the entire custom attributes map.
   * @param attributes - The custom attributes to set.
   */
  public static setAttributes(attributes: Record<string, any>): void {
    if (!LogzioRUM.instance) {
      rumLogger.warn('LogzioRUM not initialized. Call init() first.');
      return;
    }

    const contextManager = LogzioContextManager.getInstance();
    contextManager.setCustomAttributes(attributes);
  }

  /**
   * Gets the current session manager instance.
   * @returns The session manager or null if not initialized.
   */
  public static getSession(): RUMSessionManager | null {
    return LogzioRUM.session;
  }

  /**
   * Shuts down the Logzio RUM SDK.
   */
  public static shutdown(): void {
    if (LogzioRUM.session) {
      LogzioRUM.session.shutdown();
      LogzioRUM.session = null;
    }
    LogzioRUM.instance = null;
  }
}
