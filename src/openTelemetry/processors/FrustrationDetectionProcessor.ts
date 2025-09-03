import { ReadableSpan, SpanProcessor, Span } from '@opentelemetry/sdk-trace-base';
import { Context, HrTime, metrics } from '@opentelemetry/api';
import { RUMConfig } from '../../config';
import { rumLogger, LOGZIO_RUM_PROVIDER_NAME } from '../../shared';
import {
  ATTR_FRUSTRATION_TYPE,
  ATTR_FRUSTRATION_DEAD_CLICK,
  ATTR_FRUSTRATION_ERROR_CLICK,
  ATTR_FRUSTRATION_HEAVY_LOAD,
  ATTR_FRUSTRATION_RAGE_CLICK,
  ATTR_SESSION_ID,
  ATTR_VIEW_ID,
  FrustrationType,
} from '../../instrumentation';

export class FrustrationDetectionProcessor implements SpanProcessor {
  private readonly FRUSTRATION_COUNT_METRIC_NAME: string = 'frustration.count';
  private readonly FRUSTRATION_LOAD_DURATION_MS_ATTRIBUTE_NAME: string =
    'frustration.load_duration_ms';
  private readonly UNKNOWN_VALUE_FALLBACK: string = 'unknown';

  private readonly HEAVY_LOAD_THRESHOLD_MS: number;
  private readonly metricsEnabled: boolean;
  private frustrationCounter: any;

  constructor(config: RUMConfig) {
    this.HEAVY_LOAD_THRESHOLD_MS = config.frustrationThresholds!.heavyLoadThresholdMs;
    this.metricsEnabled = config.tokens!.metrics !== '';

    if (this.metricsEnabled) {
      this.initializeMetrics();
    }
  }

  private initializeMetrics(): void {
    try {
      const meter = metrics.getMeter(LOGZIO_RUM_PROVIDER_NAME);
      this.frustrationCounter = meter.createCounter(this.FRUSTRATION_COUNT_METRIC_NAME, {
        description: 'Count of user frustration signals detected',
      });
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

  private getAttributeFromSpan(
    span: ReadableSpan,
    attributeName: string,
    fallback: string,
  ): string {
    return (span.attributes[attributeName] as string) || fallback;
  }

  private getViewIdFromSpan(span: ReadableSpan): string {
    return this.getAttributeFromSpan(span, ATTR_VIEW_ID, this.UNKNOWN_VALUE_FALLBACK);
  }

  private getSessionIdFromSpan(span: ReadableSpan): string {
    return this.getAttributeFromSpan(span, ATTR_SESSION_ID, this.UNKNOWN_VALUE_FALLBACK);
  }

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
    frustrationTypes.forEach((frustrationType: any) => {
      switch (frustrationType) {
        case FrustrationType.DEAD_CLICK:
          span.attributes[ATTR_FRUSTRATION_DEAD_CLICK] = true;
          break;
        case FrustrationType.ERROR_CLICK:
          span.attributes[ATTR_FRUSTRATION_ERROR_CLICK] = true;
          break;
        case FrustrationType.HEAVY_LOAD:
          span.attributes[ATTR_FRUSTRATION_HEAVY_LOAD] = true;
          break;
        case FrustrationType.RAGE_CLICK:
          span.attributes[ATTR_FRUSTRATION_RAGE_CLICK] = true;
          break;
      }
    });
    delete span.attributes[ATTR_FRUSTRATION_TYPE];
  }

  private processNavigationSpan(span: ReadableSpan): void {
    if (this.isNavigationOrDocumentFetchSpan(span)) {
      const duration =
        this.convertOtelTimeToMs(span.endTime) - this.convertOtelTimeToMs(span.startTime);

      if (duration > this.HEAVY_LOAD_THRESHOLD_MS) {
        const viewId = this.getViewIdFromSpan(span);
        const sessionId = this.getSessionIdFromSpan(span);

        span.attributes[ATTR_FRUSTRATION_TYPE] = FrustrationType.HEAVY_LOAD;
        span.attributes[this.FRUSTRATION_LOAD_DURATION_MS_ATTRIBUTE_NAME] = duration;

        this.incrementFrustrationCounter(FrustrationType.HEAVY_LOAD, viewId, sessionId);
      }
    }
  }

  private incrementFrustrationCounter(
    type: FrustrationType,
    viewId: string,
    sessionId: string,
  ): void {
    if (!this.metricsEnabled) return;

    if (this.frustrationCounter) {
      this.frustrationCounter.add(1, {
        [ATTR_FRUSTRATION_TYPE]: type,
        [ATTR_VIEW_ID]: viewId,
        [ATTR_SESSION_ID]: sessionId,
      });
    }
  }

  private isNavigationOrDocumentFetchSpan(span: ReadableSpan): boolean {
    return span.name.startsWith('Navigation') || span.name === 'documentFetch';
  }

  private convertOtelTimeToMs(hrTime: HrTime): number {
    return hrTime[0] * 1000 + hrTime[1] / 1e6;
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
