import { ReadableSpan, SpanProcessor, Span } from '@opentelemetry/sdk-trace-base';
import { Context, HrTime, metrics } from '@opentelemetry/api';
import { AttributeNames } from '@opentelemetry/instrumentation-document-load';
import { RUMConfig } from '../../config';
import { rumLogger, LOGZIO_RUM_PROVIDER_NAME, LOGZIO_RUM_METRICS_PREFIX } from '../../shared';
import {
  ATTR_FRUSTRATION_TYPE,
  ATTR_FRUSTRATION_DEAD_CLICK,
  ATTR_FRUSTRATION_ERROR_CLICK,
  ATTR_FRUSTRATION_HEAVY_LOAD,
  ATTR_FRUSTRATION_RAGE_CLICK,
  ATTR_SESSION_ID,
  ATTR_VIEW_ID,
  FrustrationType,
  SpanName,
} from '../../instrumentation';

export class FrustrationDetectionProcessor implements SpanProcessor {
  private readonly FRUSTRATION_COUNT_METRIC_NAME: string = `${LOGZIO_RUM_METRICS_PREFIX}_frustration_count`;
  private readonly FRUSTRATION_LOAD_DURATION_MS_ATTRIBUTE_NAME: string =
    'frustration.load_duration_ms';
  private readonly UNKNOWN_VALUE_FALLBACK: string = 'unknown';

  private readonly HEAVY_LOAD_THRESHOLD_MS: number;
  private readonly metricsEnabled: boolean;
  private frustrationCounter: any = null;
  private metricsInitialized: boolean = false;

  constructor(config: RUMConfig) {
    this.HEAVY_LOAD_THRESHOLD_MS = config.frustrationThresholds!.heavyLoadThresholdMs;
    this.metricsEnabled = config.tokens!.metrics !== '';
  }

  /**
   * Initializes the frustration metrics lazily to make sure our meter is initialized.
   */
  private initializeMetrics(): void {
    if (this.metricsInitialized) {
      return;
    }

    try {
      rumLogger.debug('Initializing frustration metrics provider');
      const meter = metrics.getMeter(LOGZIO_RUM_PROVIDER_NAME);
      this.frustrationCounter = meter.createCounter(this.FRUSTRATION_COUNT_METRIC_NAME, {
        description: 'Count of user frustration signals detected',
      });
      this.metricsInitialized = true;
    } catch (error) {
      rumLogger.warn('Failed to initialize frustration metrics:', error);
    }
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  onStart(_span: Span, _parentContext: Context): void {}

  onEnd(span: ReadableSpan): void {
    this.processUserInteractionSpan(span);
    this.processNavigationSpan(span);
  }

  /**
   * Gets an attribute from the span.
   * @param span - The span to get the attribute from.
   * @param attributeName - The name of the attribute to get.
   * @param fallback - The fallback value to return if the attribute is not found.
   * @returns The attribute value.
   */
  private getAttributeFromSpan(
    span: ReadableSpan,
    attributeName: string,
    fallback: string,
  ): string {
    return (span.attributes[attributeName] as string) || fallback;
  }

  /**
   * Gets the view ID from the span.
   * @param span - The span to get the view ID from.
   * @returns The view ID.
   */
  private getViewIdFromSpan(span: ReadableSpan): string {
    return this.getAttributeFromSpan(span, ATTR_VIEW_ID, this.UNKNOWN_VALUE_FALLBACK);
  }

  /**
   * Gets the session ID from the span.
   * @param span - The span to get the session ID from.
   * @returns The session ID.
   */
  private getSessionIdFromSpan(span: ReadableSpan): string {
    return this.getAttributeFromSpan(span, ATTR_SESSION_ID, this.UNKNOWN_VALUE_FALLBACK);
  }

  /**
   * Processes user interaction spans to process frustration signals.
   * @param span - The span to process.
   */
  private processUserInteractionSpan(span: ReadableSpan): void {
    // Check if the span has frustration attributes (set by LogzioUserInteractionInstrumentation)
    const frustrationTypes = span.attributes[ATTR_FRUSTRATION_TYPE];

    if (frustrationTypes) {
      this.normalizeFrustrationAttributes(span, frustrationTypes);

      const viewId = this.getViewIdFromSpan(span);
      const sessionId = this.getSessionIdFromSpan(span);

      // Handle both single frustration type and array of frustration types
      const types = Array.isArray(frustrationTypes) ? frustrationTypes : [frustrationTypes];

      types.forEach((type: any) => {
        if (type && typeof type === 'string') {
          this.incrementFrustrationCounter(type as FrustrationType, viewId, sessionId);
        }
      });
    }
  }

  /**
   * Normalizes the frustration types to separate attributes since Jaegar doesn't support arrays for tags.
   * Also deletes the original frustration type attribute.
   * @param span - The span to normalize the frustration attributes for.
   * @param frustrationTypes - The frustration types to normalize.
   */
  private normalizeFrustrationAttributes(span: ReadableSpan, frustrationTypes: any): void {
    const types = Array.isArray(frustrationTypes) ? frustrationTypes : [frustrationTypes];

    types.forEach((frustrationType: any) => {
      const attributeName = this.mapFrustrationTypeToAttributeName(frustrationType);
      if (attributeName) {
        span.attributes[attributeName] = true;
      }
    });
    delete span.attributes[ATTR_FRUSTRATION_TYPE];
  }

  /**
   * Maps a frustration type to an attribute name.
   * @param type - The frustration type to map.
   * @returns The attribute name.
   */
  private mapFrustrationTypeToAttributeName(type: FrustrationType): string {
    switch (type) {
      case FrustrationType.DEAD_CLICK:
        return ATTR_FRUSTRATION_DEAD_CLICK;
      case FrustrationType.ERROR_CLICK:
        return ATTR_FRUSTRATION_ERROR_CLICK;
      case FrustrationType.HEAVY_LOAD:
        return ATTR_FRUSTRATION_HEAVY_LOAD;
      case FrustrationType.RAGE_CLICK:
        return ATTR_FRUSTRATION_RAGE_CLICK;
      default:
        return '';
    }
  }

  /**
   * Processes navigation spans, to detect heavy loads.
   * @param span
   */
  private processNavigationSpan(span: ReadableSpan): void {
    if (this.isLoadRelatedSpan(span)) {
      const duration =
        this.convertOtelTimeToMs(span.endTime) - this.convertOtelTimeToMs(span.startTime);

      if (duration > this.HEAVY_LOAD_THRESHOLD_MS) {
        const viewId = this.getViewIdFromSpan(span);
        const sessionId = this.getSessionIdFromSpan(span);

        this.normalizeFrustrationAttributes(span, FrustrationType.HEAVY_LOAD);
        span.attributes[this.FRUSTRATION_LOAD_DURATION_MS_ATTRIBUTE_NAME] = duration;

        this.incrementFrustrationCounter(FrustrationType.HEAVY_LOAD, viewId, sessionId);
      }
    }
  }

  /**
   * Increments the frustration counter.
   * @param type - The type of frustration.
   * @param viewId - The view ID.
   * @param sessionId - The session ID.
   */
  private incrementFrustrationCounter(
    type: FrustrationType,
    viewId: string,
    sessionId: string,
  ): void {
    if (!this.metricsEnabled) return;
    this.initializeMetrics();

    if (this.frustrationCounter) {
      rumLogger.debug(`Recording frustration metric for ${type}`);
      this.frustrationCounter.add(1, {
        [ATTR_FRUSTRATION_TYPE]: type,
        [ATTR_VIEW_ID]: viewId,
        [ATTR_SESSION_ID]: sessionId,
      });
    }
  }

  /**
   * Checks if the span is a load-related.
   * @param span - The span to check.
   * @returns True if the span is a load-related, false otherwise.
   */
  private isLoadRelatedSpan(span: ReadableSpan): boolean {
    if (
      span.name.startsWith(SpanName.NAVIGATION) ||
      span.name === AttributeNames.DOCUMENT_LOAD ||
      span.name === AttributeNames.DOCUMENT_FETCH ||
      span.name === AttributeNames.RESOURCE_FETCH ||
      span.name.startsWith('HTTP')
    ) {
      return true;
    }
    return false;
  }

  /**
   * Converts an OpenTelemetry time to milliseconds.
   * @param hrTime - The OpenTelemetry time to convert.
   * @returns The time in milliseconds.
   */
  private convertOtelTimeToMs(hrTime: HrTime): number {
    return hrTime[0] * 1000 + hrTime[1] / 1e6;
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
