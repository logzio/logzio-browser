import { InstrumentationBase, InstrumentationConfig } from '@opentelemetry/instrumentation';
import { SpanStatusCode, SpanKind, Attributes } from '@opentelemetry/api';
import {
  ATTR_URL_PATH,
  ATTR_ERROR_TYPE,
  ATTR_CODE_COLUMN_NUMBER,
  ATTR_CODE_LINE_NUMBER,
  ATTR_CODE_FILE_PATH,
} from '@opentelemetry/semantic-conventions';
import { DOM_EVENT, rumLogger } from '../shared';
import { ErrorTracker, ErrorEventData } from './trackers';
import { SpanName } from './semconv';

enum ErrorCategory {
  UNHANDLED_EXCEPTION = 'runtime',
  UNHANDLED_REJECTION = 'promise',
  MANUAL_ERROR = 'manual', // TODO: Add a public method to the LogzioRum SDK to allow manually reporting exceptions.
}

/**
 * This class represents instrumentation for collecting exceptions.
 * It instruments the global error and unhandled rejection events and emits spans to the OpenTelemetry API.
 */
export class ErrorTrackingInstrumentation extends InstrumentationBase {
  private static readonly NAME = 'error';
  private static readonly VERSION = '1.0.0';

  private errorUnsubscribe: (() => void) | null = null;

  constructor(config: InstrumentationConfig) {
    super(ErrorTrackingInstrumentation.NAME, ErrorTrackingInstrumentation.VERSION, config);
  }

  public init(): void {
    // This method is called during instrumentation registration
    // The actual setup happens in enable()
  }

  public enable(): void {
    super.enable();
    try {
      this.setupErrorTracking();
    } catch (error) {
      rumLogger.error('Failed to enable error tracking instrumentation:', error);
    }
  }

  public disable(): void {
    super.disable();
    try {
      if (this.errorUnsubscribe) {
        this.errorUnsubscribe();
        this.errorUnsubscribe = null;
      }
    } catch (error) {
      rumLogger.error('Failed to disable error tracking instrumentation:', error);
    }
  }

  /**
   * Sets up the error tracking.
   */
  private setupErrorTracking(): void {
    const errorTracker = ErrorTracker.getInstance();
    this.errorUnsubscribe = errorTracker.subscribe(this.handleError.bind(this));
  }

  /**
   * Handles error and rejection events from ErrorTracker.
   * @param event - The error event data
   */
  private handleError(event: ErrorEventData): void {
    const error = new Error(event.message);
    if (event.stack) {
      error.stack = event.stack;
    }

    const category =
      event.kind === DOM_EVENT.ERROR
        ? ErrorCategory.UNHANDLED_EXCEPTION
        : ErrorCategory.UNHANDLED_REJECTION;

    const extraAttributes: Attributes = {};
    if (event.filename) {
      extraAttributes[ATTR_URL_PATH] = window.location.href;
      extraAttributes[ATTR_CODE_FILE_PATH] = event.filename;
    }
    if (event.line !== undefined) {
      extraAttributes[ATTR_CODE_LINE_NUMBER] = event.line;
    }
    if (event.column !== undefined) {
      extraAttributes[ATTR_CODE_COLUMN_NUMBER] = event.column;
    }

    this.recordException(error, category, extraAttributes);
  }

  /**
   * Records an exception.
   * @param error - The error.
   * @param category - The error category.
   * @param extraAttributes - The extra attributes.
   */
  private recordException(
    error: Error,
    category: ErrorCategory,
    extraAttributes?: Attributes,
  ): void {
    try {
      const spanName = this.getSemanticSpanName(category);
      const attributes = this.buildErrorAttributes(category, extraAttributes);

      const span = this.tracer.startSpan(spanName, {
        kind: SpanKind.INTERNAL,
        attributes,
      });

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });

      span.recordException(error);

      span.end();
    } catch (recordError) {
      rumLogger.error('Failed to record exception:', recordError);
    }
  }

  /**
   * Builds the error attributes.
   * @param category - The error category.
   * @param extraAttributes - The extra attributes.
   * @returns The error attributes.
   */
  private buildErrorAttributes(category: ErrorCategory, extraAttributes?: Attributes): Attributes {
    return {
      [ATTR_ERROR_TYPE]: category,
      ...(extraAttributes || {}),
    };
  }

  /**
   * Returns the semantic span name.
   * @param category - The error category.
   * @returns The semantic span name.
   */
  private getSemanticSpanName(category: ErrorCategory): string {
    switch (category) {
      case ErrorCategory.UNHANDLED_EXCEPTION:
        return SpanName.RUNTIME_EXCEPTION;
      case ErrorCategory.UNHANDLED_REJECTION:
        return SpanName.APP_EXCEPTION;
      case ErrorCategory.MANUAL_ERROR:
        return SpanName.RUM_EXCEPTION;
      default:
        return SpanName.RUM_EXCEPTION;
    }
  }
}
