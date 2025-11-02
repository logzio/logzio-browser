import { SdkLogRecord as LogRecord, LogRecordProcessor } from '@opentelemetry/sdk-logs';
import { ATTR_REQUEST_PATH } from '../../instrumentation';

/**
 * Adds request path (URL pathname) to log records if not already present.
 * This ensures all log events include the request path for proper correlation.
 */
export class RequestPathLogProcessor implements LogRecordProcessor {
  constructor() {}

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  onEmit(logRecord: LogRecord): void {
    try {
      // Only add if not already present
      if (logRecord.attributes[ATTR_REQUEST_PATH] === undefined) {
        const pathname = window.location.pathname;
        if (pathname) {
          logRecord.setAttribute(ATTR_REQUEST_PATH, pathname);
        }
      }
    } catch (_error) {
      // No-throw policy: silently continue if enrichment fails
    }
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
