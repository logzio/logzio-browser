// Mock OpenTelemetry instrumentation
jest.mock('@opentelemetry/instrumentation', () => ({
  InstrumentationBase: class {
    constructor() {}
    enable() {}
    disable() {}
  },
}));

// Mock shared dependencies
jest.mock('@src/shared', () => ({
  rumLogger: {
    error: jest.fn(),
  },
}));

// Mock semconv
jest.mock('@src/instrumentation/semconv', () => ({
  ATTR_CONSOLE_STACK_TRACE: 'console.stack_trace',
}));

// Mock api-logs for severity numbers
jest.mock('@opentelemetry/api-logs', () => ({
  SeverityNumber: {
    ERROR: 17,
    WARN: 13,
    INFO: 9,
    DEBUG: 5,
  },
}));

import { SeverityNumber } from '@opentelemetry/api-logs';
import { ConsoleLogsInstrumentation } from '@src/instrumentation/ConsoleLogs';
import { rumLogger } from '@src/shared';

describe('ConsoleLogsInstrumentation Emission', () => {
  let instrumentation: ConsoleLogsInstrumentation;
  let mockLogger: { emit: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    instrumentation = new ConsoleLogsInstrumentation({});
    mockLogger = { emit: jest.fn() };
    (instrumentation as any).logger = mockLogger;
    instrumentation.enable();
  });

  afterEach(() => {
    instrumentation.disable();
    jest.restoreAllMocks();
  });

  it.each([
    ['error', SeverityNumber.ERROR],
    ['warn', SeverityNumber.WARN],
    ['info', SeverityNumber.INFO],
    ['log', SeverityNumber.INFO],
    ['debug', SeverityNumber.DEBUG],
  ])(
    'should emit log with proper severityText and severityNumber for %s',
    (method, expectedSeverity) => {
      (console as any)[method]('test message');

      expect(mockLogger.emit).toHaveBeenCalledTimes(1);
      const logRecord = mockLogger.emit.mock.calls[0][0];

      expect(logRecord.severityText).toBe(method);
      expect(logRecord.severityNumber).toBe(expectedSeverity);
      expect(logRecord.body).toBe('test message');
    },
  );

  it('should format body from mixed args', () => {
    console.log('a', { x: 1 }, 2);

    expect(mockLogger.emit).toHaveBeenCalledTimes(1);
    const logRecord = mockLogger.emit.mock.calls[0][0];

    expect(logRecord.body).toBe('a {"x":1} 2');
  });

  it('should format body safely for circular objects', () => {
    const obj: any = {};
    obj.self = obj;

    expect(() => console.log('x', obj)).not.toThrow();

    expect(mockLogger.emit).toHaveBeenCalledTimes(1);
    const logRecord = mockLogger.emit.mock.calls[0][0];

    expect(logRecord.body).toContain('x');
    expect(typeof logRecord.body).toBe('string');
  });

  it('should attach filtered stack trace attribute for error logs only', () => {
    console.error('boom');

    expect(mockLogger.emit).toHaveBeenCalledTimes(1);
    const logRecord = mockLogger.emit.mock.calls[0][0];
    const stackTrace = logRecord.attributes['console.stack_trace'];

    expect(typeof stackTrace).toBe('string');
    expect(stackTrace).not.toContain('ConsoleLogsInstrumentation');
    expect(stackTrace).not.toContain('patchConsole');
    expect(stackTrace).not.toContain('emitLog');

    // Should have reasonable number of lines (≤10)
    const lines = stackTrace.split('\n').filter((line: string) => line.trim());
    expect(lines.length).toBeLessThanOrEqual(10);
  });

  it('should not attach stack trace for non-error logs', () => {
    console.warn('warning message');
    console.info('info message');
    console.log('log message');
    console.debug('debug message');

    expect(mockLogger.emit).toHaveBeenCalledTimes(4);

    // Check that none of the non-error logs have stack traces
    mockLogger.emit.mock.calls.forEach(([logRecord]) => {
      expect(logRecord.attributes['console.stack_trace']).toBeUndefined();
    });
  });

  it('should catch emitLog errors and do not break original console behavior', () => {
    const errorSpy = jest.spyOn(console, 'error');

    jest.spyOn(instrumentation as any, 'emitLog').mockImplementation(() => {
      throw new Error('emit fail');
    });

    expect(() => console.error('x')).not.toThrow();

    expect(rumLogger.error).toHaveBeenCalledWith(
      'Failed to emit console log record:',
      expect.any(Error),
    );
    expect(errorSpy).toHaveBeenCalledWith('x');
  });

  it('should be safe with empty args and non-string first arg', () => {
    console.log();
    console.log({ a: 1 });

    expect(mockLogger.emit).toHaveBeenCalledTimes(2);

    const firstLogRecord = mockLogger.emit.mock.calls[0][0];
    const secondLogRecord = mockLogger.emit.mock.calls[1][0];

    expect(typeof firstLogRecord.body).toBe('string');
    expect(typeof secondLogRecord.body).toBe('string');
    expect(secondLogRecord.body).toBe('{"a":1}');
  });
});
