import { getIfBetween, getIfMoreThan } from '../utils';
import { LogLevel, rumLogger } from '../shared';
import {
  DEFAULT_SERVICE_NAME,
  DEFAULT_SERVICE_VERSION,
  DEFAULT_SESSION_MAX_DURATION_MS,
  DEFAULT_SESSION_TIMEOUT_MS,
  DEFAULT_ENABLE_STATE,
  DEFAULT_SAMPLE_RATE,
  DEFAULT_RAGE_CLICK_COUNT,
  DEFAULT_RAGE_CLICK_INTERVAL_MS,
  DEFAULT_HEAVY_LOAD_THRESHOLD_MS,
  DEFAULT_DISABLE_STATE,
  DEFAULT_LOG_LEVEL,
} from './defaults';
import { RUMConfigOptions } from './types';

/**
 * This class represents the RUM configuration.
 * It holds the configuration for the RUM.
 */
export class RUMConfig {
  public readonly region: string;
  public readonly tokens: Required<RUMConfigOptions['tokens']>;
  public readonly endpoint: Required<RUMConfigOptions['endpoint']>;
  public readonly service: Required<RUMConfigOptions['service']>;
  public readonly session: Required<RUMConfigOptions['session']>;
  public readonly enable: Required<RUMConfigOptions['enable']>;
  public readonly environmentData: Required<RUMConfigOptions['environmentData']>;
  public readonly customAttributes: Record<string, any>;
  public readonly propagateTraceHeaderCorsUrls: (string | RegExp)[];
  public readonly samplingRate: number;
  public readonly frustrationThresholds: Required<RUMConfigOptions['frustrationThresholds']>;
  public readonly logLevel: LogLevel;

  /**
   * Initializes the RUM configuration.
   * Verifies required fields, sets default values, and validates conditional fields.
   * @param config - The RUM configuration options.
   */
  constructor(config: Partial<RUMConfigOptions>) {
    RUMConfig.validateRequiredFields(config);

    this.region = config.region!;
    this.tokens = {
      logs: config.tokens!.logs ?? '',
      traces: config.tokens!.traces,
    };
    this.endpoint = {
      url: (config.endpoint?.url || '').trim(),
      addSuffix: config.endpoint?.addSuffix ?? false,
    };
    this.service = {
      name: config.service?.name ?? DEFAULT_SERVICE_NAME,
      version: config.service?.version ?? DEFAULT_SERVICE_VERSION,
    };
    this.session = {
      maxDurationMs: getIfMoreThan(
        config.session?.maxDurationMs,
        0,
        DEFAULT_SESSION_MAX_DURATION_MS,
      ),
      timeoutMs: getIfMoreThan(config.session?.timeoutMs, 0, DEFAULT_SESSION_TIMEOUT_MS),
    };
    this.enable = {
      userActions: config.enable?.userActions ?? DEFAULT_ENABLE_STATE,
      navigation: config.enable?.navigation ?? DEFAULT_ENABLE_STATE,
      documentLoad: config.enable?.documentLoad ?? DEFAULT_ENABLE_STATE,
      resourceLoad: config.enable?.resourceLoad ?? DEFAULT_ENABLE_STATE,
      errorTracking: config.enable?.errorTracking ?? DEFAULT_ENABLE_STATE,
      frustrationDetection: config.enable?.frustrationDetection ?? DEFAULT_ENABLE_STATE,
      webVitals: config.enable?.webVitals ?? DEFAULT_ENABLE_STATE,
      viewEvents: config.enable?.viewEvents ?? DEFAULT_DISABLE_STATE,
      consoleLogs: config.enable?.consoleLogs ?? DEFAULT_DISABLE_STATE,
    };
    this.environmentData = {
      collectOS: config.environmentData?.collectOS ?? DEFAULT_ENABLE_STATE,
      collectBrowser: config.environmentData?.collectBrowser ?? DEFAULT_ENABLE_STATE,
      collectDevice: config.environmentData?.collectDevice ?? DEFAULT_ENABLE_STATE,
      collectLanguage: config.environmentData?.collectLanguage ?? DEFAULT_ENABLE_STATE,
    };
    this.customAttributes = config.customAttributes || {};
    this.propagateTraceHeaderCorsUrls = config.propagateTraceHeaderCorsUrls || [];
    this.samplingRate = getIfBetween(config.samplingRate, 0, 100, DEFAULT_SAMPLE_RATE);
    this.frustrationThresholds = {
      rageClickCount: getIfMoreThan(
        config.frustrationThresholds?.rageClickCount,
        0,
        DEFAULT_RAGE_CLICK_COUNT,
      ),
      rageClickIntervalMs: getIfMoreThan(
        config.frustrationThresholds?.rageClickIntervalMs,
        0,
        DEFAULT_RAGE_CLICK_INTERVAL_MS,
      ),
      heavyLoadThresholdMs: getIfMoreThan(
        config.frustrationThresholds?.heavyLoadThresholdMs,
        0,
        DEFAULT_HEAVY_LOAD_THRESHOLD_MS,
      ),
    };
    this.logLevel = this.getLogLevel(config.logLevel ?? DEFAULT_LOG_LEVEL);
    this.validateConditionalFields();
  }

  /**
   * Returns the RUM logger log level.
   * @param logLevel - The string log level to convert to a LogLevel enum value.
   * @returns The LogLevel enum value.
   */
  private getLogLevel(logLevel: string): LogLevel {
    logLevel = logLevel.toLowerCase();
    switch (logLevel) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'warn':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      case 'off':
        return LogLevel.OFF;
      default:
        return LogLevel.INFO;
    }
  }

  /**
   * Validates the required fields.
   * @param config - The RUM configuration options.
   */
  private static validateRequiredFields(config: Partial<RUMConfigOptions>): void {
    if (!config.region) throw new Error('Region is required in RUM configuration.');
    if (!config.tokens) throw new Error('Tokens are required in RUM configuration.');
    if (!config.tokens.traces) throw new Error('Traces token is required in RUM configuration.');
    if (!config.endpoint || !config.endpoint.url)
      throw new Error('Endpoint URL is required in RUM configuration.');
    try {
      new URL(config.endpoint.url);
    } catch {
      throw new Error(`Invalid Endpoint URL "${config.endpoint.url}".`);
    }
  }

  /**
   * Validates the conditional fields.
   */
  private validateConditionalFields(): void {
    if (
      !this.tokens.logs &&
      (this.enable?.errorTracking ||
        this.enable?.viewEvents ||
        this.enable?.consoleLogs ||
        this.enable?.webVitals)
    ) {
      rumLogger.warn(
        'Logs token is required in RUM configuration when error tracking, view events, console logs, or web vitals are enabled. These features will not be sent.',
      );
      this.enable.errorTracking = DEFAULT_DISABLE_STATE;
      this.enable.viewEvents = DEFAULT_DISABLE_STATE;
      this.enable.consoleLogs = DEFAULT_DISABLE_STATE;
      this.enable.webVitals = DEFAULT_DISABLE_STATE;
    }
  }
}
