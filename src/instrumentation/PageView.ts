import { Tracer, Span, trace } from '@opentelemetry/api';
import { AttributeNames as otelAttributeNames } from '@opentelemetry/instrumentation-user-interaction';
import { LOGZIO_RUM_PROVIDER_NAME } from '../shared';
import { rumContextManager } from '../context/LogzioContextManager';
import { ATTR_SESSION_ID, ATTR_VIEW_ID, SpanName } from './semconv';

/**
 * This class represents instrumentation for tracking page views.
 * It starts and ends a parent page view span and sets the session and view IDs.
 */
export class PageViewInstrumentation {
  private tracer: Tracer;
  private activeSpan: Span | null = null;

  constructor() {
    this.tracer = trace.getTracer(LOGZIO_RUM_PROVIDER_NAME);
  }

  /**
   * Starts the page view spans.
   * @param sessionId - The session ID.
   * @param viewId - The view ID.
   */
  public startPageViewSpans(sessionId: string, viewId: string): void {
    if (this.activeSpan) this.activeSpan.end();

    this.activeSpan = this.tracer.startSpan(SpanName.NAVIGATION, {
      attributes: {
        [ATTR_SESSION_ID]: sessionId,
        [ATTR_VIEW_ID]: viewId,
        [otelAttributeNames.EVENT_TYPE]: SpanName.NAVIGATION,
        [otelAttributeNames.HTTP_URL]: window.location.href,
      },
    });

    // Use the context manager to set the page view context globally
    rumContextManager.setPageViewContext(this.activeSpan, sessionId, viewId);
  }

  /**
   * Ends the page view span.
   */
  public endPageViewSpan(): void {
    if (this.activeSpan) {
      this.activeSpan.end();
      this.activeSpan = null;
    }
  }
}
