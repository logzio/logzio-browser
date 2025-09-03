import { ReadableSpan, SpanProcessor, Span } from '@opentelemetry/sdk-trace-base';
import { Context } from '@opentelemetry/api';
import { ATTR_SESSION_ID, ATTR_VIEW_ID } from '../../instrumentation';
import { rumContextManager } from '../../context/LogzioContextManager';
import { SessionManager } from '../../shared';

/**
 * Adds session ID, view ID, and custom attributes to spans by reading from the session manager and context.
 * This processor enriches spans with live data at span start time.
 */
export class SessionContextSpanProcessor implements SpanProcessor {
  private sessionManager: SessionManager | null = null;

  constructor() {}

  /**
   * Sets the session manager reference after it's created.
   * This is called by the setup after the session manager is initialized.
   */
  public setSessionManager(sessionManager: SessionManager): void {
    this.sessionManager = sessionManager;
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  onStart(span: Span, parentContext: Context): void {
    try {
      const sessionId = this.sessionManager?.getSessionId();
      if (sessionId && span.attributes[ATTR_SESSION_ID] === undefined) {
        span.setAttribute(ATTR_SESSION_ID, sessionId);
      }

      const spanStartTime = span.startTime[0] * 1000 + Math.floor(span.startTime[1] / 1000000);
      const viewInfo = this.sessionManager?.getActiveViewAt(spanStartTime);

      if (viewInfo?.id && span.attributes[ATTR_VIEW_ID] === undefined) {
        // Special case: if this is a navigation span and a new view started shortly after,
        // associate with the new view instead of the old one
        const isNavigationSpan = span.name.includes('navigation');
        if (isNavigationSpan) {
          const currentView = this.sessionManager?.getActiveView();
          // If current view started within 500ms after span start, use current view
          if (
            currentView &&
            currentView.startedAt > spanStartTime &&
            currentView.startedAt - spanStartTime <= 500
          ) {
            span.setAttribute(ATTR_VIEW_ID, currentView.id);
          } else {
            span.setAttribute(ATTR_VIEW_ID, viewInfo.id);
          }
        } else {
          span.setAttribute(ATTR_VIEW_ID, viewInfo.id);
        }
      }

      const customAttributes = rumContextManager.getCustomAttributes(parentContext);
      if (customAttributes && Object.keys(customAttributes).length > 0) {
        Object.entries(customAttributes).forEach(([key, value]) => {
          if (span.attributes[key] === undefined) {
            span.setAttribute(key, String(value));
          }
        });
      }
    } catch (_error) {
      // No-throw policy: silently continue if enrichment fails
    }
  }

  onEnd(_span: ReadableSpan): void {}

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
