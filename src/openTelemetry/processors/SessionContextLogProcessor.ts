import { SdkLogRecord as LogRecord, LogRecordProcessor } from '@opentelemetry/sdk-logs';
import { ATTR_SESSION_ID, ATTR_VIEW_ID } from '../../instrumentation';
import { rumContextManager } from '../../context/LogzioContextManager';

/**
 * Adds session ID, view ID, and custom attributes to log records by reading from the active context.
 * This processor is context-aware and works with the LogzioContextManager.
 */
export class SessionContextLogProcessor implements LogRecordProcessor {
  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  onEmit(logRecord: LogRecord): void {
    const activeContext = rumContextManager.active();
    const sessionId = rumContextManager.getSessionId(activeContext);
    const viewId = rumContextManager.getViewId(activeContext);
    const customAttributes = rumContextManager.getCustomAttributes(activeContext);

    if (sessionId && logRecord.attributes[ATTR_SESSION_ID] === undefined) {
      logRecord.setAttribute(ATTR_SESSION_ID, sessionId);
    }

    if (viewId && logRecord.attributes[ATTR_VIEW_ID] === undefined) {
      logRecord.setAttribute(ATTR_VIEW_ID, viewId);
    }

    // Apply custom attributes
    if (customAttributes && Object.keys(customAttributes).length > 0) {
      Object.entries(customAttributes).forEach(([key, value]) => {
        if (logRecord.attributes[key] === undefined) {
          logRecord.setAttribute(key, String(value));
        }
      });
    }
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
