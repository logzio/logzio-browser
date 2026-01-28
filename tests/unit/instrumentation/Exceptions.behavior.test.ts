import { LoggerProvider, LogRecordProcessor } from '@opentelemetry/sdk-logs';
import { logs } from '@opentelemetry/api-logs';
import { ExceptionInstrumentation } from '@opentelemetry/instrumentation-web-exception';
import {
  ATTR_CODE_COLUMN_NUMBER,
  ATTR_CODE_FILE_PATH,
  ATTR_CODE_LINE_NUMBER,
  ATTR_ERROR_TYPE,
  ATTR_URL_PATH,
} from '@opentelemetry/semantic-conventions';
import { ExceptionHelper } from '@src/instrumentation';
import { SessionContextLogProcessor } from '@src/openTelemetry/processors/SessionContextLogProcessor';
import { ATTR_SESSION_ID, ATTR_VIEW_ID } from '@src/instrumentation/semconv';

class CaptureLogProcessor implements LogRecordProcessor {
  public records: any[] = [];

  onEmit(logRecord: any): void {
    this.records.push(logRecord);
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

describe('ExceptionHelper', () => {
  it('should map runtime errors to OTel attributes', () => {
    const error = new Error('boom');
    error.stack = 'Error: boom\n at https://app.example.com/index.js:10:20';

    const attributes = ExceptionHelper.getCustomAttributes(error);

    expect(attributes[ATTR_URL_PATH]).toBe(window.location.href);
    expect(attributes[ATTR_ERROR_TYPE]).toBe('runtime');
    expect(attributes[ATTR_CODE_FILE_PATH]).toBe('https://app.example.com/index.js');
    expect(attributes[ATTR_CODE_LINE_NUMBER]).toBe(10);
    expect(attributes[ATTR_CODE_COLUMN_NUMBER]).toBe(20);
  });

  it('should tolerate missing stack trace fields', () => {
    const error = new Error('boom');
    error.stack = 'Error: boom\n at <anonymous>';

    const attributes = ExceptionHelper.getCustomAttributes(error);

    expect(attributes[ATTR_URL_PATH]).toBe(window.location.href);
    expect(attributes[ATTR_ERROR_TYPE]).toBe('runtime');
    expect(attributes[ATTR_CODE_FILE_PATH]).toBeUndefined();
    expect(attributes[ATTR_CODE_LINE_NUMBER]).toBeUndefined();
    expect(attributes[ATTR_CODE_COLUMN_NUMBER]).toBeUndefined();
  });
});

describe('ExceptionInstrumentation log context', () => {
  beforeEach(() => {
    logs.disable();
  });

  afterEach(() => {
    logs.disable();
  });

  it('should attach session and view ids to exception log records', () => {
    const sessionProcessor = new SessionContextLogProcessor();
    sessionProcessor.setSessionManager({
      getSessionId: () => 'session-123',
      getActiveView: () => ({ id: 'view-456', startedAt: Date.now() }),
    } as any);

    const capture = new CaptureLogProcessor();
    const provider = new LoggerProvider({
      processors: [sessionProcessor, capture],
    });

    logs.setGlobalLoggerProvider(provider);

    const instrumentation = new ExceptionInstrumentation({
      applyCustomAttributes: () => ({}),
    });

    (instrumentation as any).onError({ error: new Error('boom') });

    expect(capture.records).toHaveLength(1);
    const attributes = capture.records[0].attributes;
    expect(attributes[ATTR_SESSION_ID]).toBe('session-123');
    expect(attributes[ATTR_VIEW_ID]).toBe('view-456');
  });
});
