import { ReadableSpan, SpanProcessor, Span } from '@opentelemetry/sdk-trace-base';
import { Context } from '@opentelemetry/api';
import { ATTR_REQUEST_PATH } from '../../instrumentation';

/**
 * Adds request path (URL pathname) to spans if not already present.
 * This ensures all trace spans include the request path for proper correlation.
 */
export class RequestPathSpanProcessor implements SpanProcessor {
  constructor() {}

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  onStart(span: Span, _parentContext: Context): void {
    try {
      // Only add if not already present
      if (span.attributes[ATTR_REQUEST_PATH] === undefined) {
        const pathname = window.location.pathname;
        if (pathname) {
          span.setAttribute(ATTR_REQUEST_PATH, pathname);
        }
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
