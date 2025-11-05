import { ReadableSpan, SpanProcessor, Span } from '@opentelemetry/sdk-trace-base';
import { Context, HrTime } from '@opentelemetry/api';
import { AttributeNames } from '@opentelemetry/instrumentation-document-load';
import { RUMConfig } from '../../config';
import { rumLogger } from '../../shared';
import {
  ATTR_FRUSTRATION_TYPE,
  ATTR_FRUSTRATION_DEAD_CLICK,
  ATTR_FRUSTRATION_ERROR_CLICK,
  ATTR_FRUSTRATION_HEAVY_LOAD,
  ATTR_FRUSTRATION_RAGE_CLICK,
  FrustrationType,
  SpanName,
} from '../../instrumentation';

export class FrustrationDetectionProcessor implements SpanProcessor {
  private readonly FRUSTRATION_LOAD_DURATION_MS_ATTRIBUTE_NAME: string =
    'frustration.load_duration_ms';

  private readonly HEAVY_LOAD_THRESHOLD_MS: number;

  constructor(config: RUMConfig) {
    this.HEAVY_LOAD_THRESHOLD_MS = config.frustrationThresholds!.heavyLoadThresholdMs;
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
   * Processes user interaction spans to process frustration signals.
   * @param span - The span to process.
   */
  private processUserInteractionSpan(span: ReadableSpan): void {
    // Check if the span has frustration attributes (set by LogzioUserInteractionInstrumentation)
    const frustrationTypes = span.attributes[ATTR_FRUSTRATION_TYPE];

    if (frustrationTypes) {
      this.normalizeFrustrationAttributes(span, frustrationTypes);
      rumLogger.debug(`Detected frustration on span: ${JSON.stringify(frustrationTypes)}`);
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
        this.normalizeFrustrationAttributes(span, FrustrationType.HEAVY_LOAD);
        span.attributes[this.FRUSTRATION_LOAD_DURATION_MS_ATTRIBUTE_NAME] = duration;
        rumLogger.debug(`Detected heavy load: ${duration}ms on span ${span.name}`);
      }
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
