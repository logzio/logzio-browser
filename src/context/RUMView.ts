import { Logger, logs } from '@opentelemetry/api-logs';
import { AttributeNames as otelAttributeNames } from '@opentelemetry/instrumentation-user-interaction';
import { ATTR_URL_PATH } from '@opentelemetry/semantic-conventions';
import { ATTR_SESSION_ID, ATTR_VIEW_ID } from '../instrumentation';
import { WebVitalsAggregator } from '../aggregations/WebVitalsAggregator';
import type { RUMConfig } from '../config';
import { generateId } from '../utils';
import { OpenTelemetryProvider } from '../openTelemetry/setup';
import { LOGZIO_RUM_PROVIDER_NAME, rumLogger } from '../shared';
import { rumContextManager } from './LogzioContextManager';

/**
 * This class represents a view for the RUM.
 * It manages view lifecycle through context updates and log events.
 */
export class RUMView {
  private static readonly VIEW_END_EVENT_NAME = 'view_end';
  private static readonly VIEW_START_EVENT_NAME = 'view_start';

  private viewId: string;
  private url: string;
  private startTime: number | null = null;
  private aggregator: WebVitalsAggregator | null = null;
  private logsProvider: Logger = logs.getLogger(LOGZIO_RUM_PROVIDER_NAME);

  constructor(
    private readonly sessionId: string,
    private readonly config: RUMConfig,
  ) {
    this.viewId = generateId();
    this.url = window.location.href;
  }

  /**
   * Starts a view.
   */
  public start(): void {
    rumLogger.debug(`Starting view ${this.viewId}.`);
    this.startTime = Date.now();
    rumContextManager.setViewContext(this.sessionId, this.viewId);
    this.generateStartEvent();
    this.startMetricAggregation();
  }

  /**
   * Ends a view.
   */
  public end(): void {
    rumLogger.debug(`Ending view ${this.viewId}.`);
    this.aggregator?.flushMetrics();
    this.generateEndEvent();
  }

  /**
   * Generates a start event to indicate the view has started.
   */
  private generateStartEvent(): void {
    if (this.config.enable?.viewEvents) {
      this.logsProvider.emit({
        severityText: 'INFO',
        attributes: {
          ...this.getAttributes(RUMView.VIEW_START_EVENT_NAME),
        },
      });
    }
  }

  /**
   * Starts the metric aggregation.
   */
  private startMetricAggregation(): void {
    if (this.config.enable?.webVitals) {
      const otelProvider = OpenTelemetryProvider.getInstance(this.config);
      this.aggregator = new WebVitalsAggregator(
        otelProvider.getMeterProvider(),
        this.sessionId,
        this.viewId,
      );
      this.aggregator.start();
    }
  }

  /**
   * Generates an end event to indicate the view has ended.
   */
  private generateEndEvent(): void {
    if (this.config.enable?.viewEvents) {
      this.logsProvider.emit({
        severityText: 'INFO',
        attributes: {
          ...this.getAttributes(RUMView.VIEW_END_EVENT_NAME),
          duration: this.getDuration(),
        },
      });
    }
  }

  /**
   * Returns the attributes to add to the view event.
   * @param eventType - The type of event.
   * @returns The attributes to add to the view event.
   */
  private getAttributes(eventType: string): Record<string, any> {
    return {
      [ATTR_URL_PATH]: this.url,
      startTime: this.startTime,
      [ATTR_SESSION_ID]: this.sessionId,
      [ATTR_VIEW_ID]: this.viewId,
      [otelAttributeNames.EVENT_TYPE]: eventType,
    };
  }

  /**
   * Returns the view id.
   * @returns The view id.
   */
  public getViewId(): string {
    return this.viewId;
  }

  /**
   * Returns the url of the view.
   * @returns The url of the view.
   */
  public getUrl(): string {
    return this.url;
  }

  /**
   * Returns the start time of the view.
   * @returns The start time in milliseconds since epoch, or null if not started.
   */
  public getStartTime(): number | null {
    return this.startTime;
  }

  /**
   * Returns the duration of the view.
   * @returns The duration of the view in milliseconds.
   */
  public getDuration(): number {
    // prettier-ignore
    return this.startTime
            ? Date.now() - this.startTime
            : 0;
  }
}
