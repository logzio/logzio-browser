import { ReadableSpan, SpanProcessor, Span } from '@opentelemetry/sdk-trace-base';
import { Context } from '@opentelemetry/api';
import { ATTR_SESSION_ID, ATTR_VIEW_ID } from '../../instrumentation';
import { rumContextManager } from '../../context/LogzioContextManager';

/**
 * Adds session ID, view ID, and custom attributes to spans by reading from the active context.
 * This processor is context-aware and works with the LogzioContextManager.
 */
export class SessionContextSpanProcessor implements SpanProcessor {
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  onStart(span: Span, parentContext: Context): void {
    const sessionId = rumContextManager.getSessionId(parentContext);
    const viewId = rumContextManager.getViewId(parentContext);
    const customAttributes = rumContextManager.getCustomAttributes(parentContext);

    if (sessionId && span.attributes[ATTR_SESSION_ID] === undefined) {
      span.setAttribute(ATTR_SESSION_ID, sessionId);
    }

    if (viewId && span.attributes[ATTR_VIEW_ID] === undefined) {
      span.setAttribute(ATTR_VIEW_ID, viewId);
    }

    // Apply custom attributes
    if (customAttributes && Object.keys(customAttributes).length > 0) {
      Object.entries(customAttributes).forEach(([key, value]) => {
        if (span.attributes[key] === undefined) {
          span.setAttribute(key, String(value));
        }
      });
    }
  }

  onEnd(_span: ReadableSpan): void {}

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
