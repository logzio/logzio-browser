import { SdkLogRecord as LogRecord, LogRecordProcessor } from '@opentelemetry/sdk-logs';
import { ATTR_SESSION_ID, ATTR_VIEW_ID } from '../../instrumentation';
import { rumContextManager } from '../../context/LogzioContextManager';
import { SessionManager } from '../../shared';

/**
 * Adds session ID, view ID, and custom attributes to log records by reading from the session manager and context.
 * This processor enriches logs with live data at emit time.
 */
export class SessionContextLogProcessor implements LogRecordProcessor {
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

  onEmit(logRecord: LogRecord): void {
    try {
      const sessionId = this.sessionManager?.getSessionId();
      if (sessionId && logRecord.attributes[ATTR_SESSION_ID] === undefined) {
        logRecord.setAttribute(ATTR_SESSION_ID, sessionId);
      }

      const viewInfo = this.sessionManager?.getActiveView();
      if (viewInfo?.id && logRecord.attributes[ATTR_VIEW_ID] === undefined) {
        logRecord.setAttribute(ATTR_VIEW_ID, viewInfo.id);
      }

      const activeContext = rumContextManager.active();
      const customAttributes = rumContextManager.getCustomAttributes(activeContext);
      if (customAttributes && Object.keys(customAttributes).length > 0) {
        Object.entries(customAttributes).forEach(([key, value]) => {
          if (logRecord.attributes[key] === undefined) {
            logRecord.setAttribute(key, String(value));
          }
        });
      }
    } catch (_error) {
      // No-throw policy: silently continue if enrichment fails
    }
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
