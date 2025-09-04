import { InstrumentationBase, InstrumentationConfig } from '@opentelemetry/instrumentation';
import { LogRecord, SeverityNumber } from '@opentelemetry/api-logs';
import { rumLogger } from '../shared';
import { ATTR_CONSOLE_STACK_TRACE } from './semconv';

const CONSOLE_METHODS_ARRAY = ['log', 'info', 'warn', 'error', 'debug'] as const;

type ConsoleMethod = (typeof CONSOLE_METHODS_ARRAY)[number];

/**
 * This class represents instrumentation for collecting console logs.
 * It instruments the console methods and emits log records to the OpenTelemetry API.
 */
export class ConsoleLogsInstrumentation extends InstrumentationBase {
  private static readonly NAME = 'console-logs';
  private static readonly VERSION = '1.0.0';
  private readonly MAX_FRAMES = 10;

  private originalConsoleMethods: Partial<Record<ConsoleMethod, (...args: any[]) => void>> = {};

  constructor(config: InstrumentationConfig) {
    super(ConsoleLogsInstrumentation.NAME, ConsoleLogsInstrumentation.VERSION, config);
  }

  public init(): void {
    // This method is called during instrumentation registration
    // The actual setup happens in enable()
  }

  public enable(): void {
    try {
      this.patchConsole();
    } catch (err) {
      rumLogger.error('Failed to enable console logs instrumentation:', err);
    }
  }

  public disable(): void {
    try {
      this.unpatchConsole();
    } catch (err) {
      rumLogger.error('Failed to disable console logs instrumentation:', err);
    }
  }

  /**
   * Patches the console methods.
   */
  private patchConsole(): void {
    CONSOLE_METHODS_ARRAY.forEach((method) => {
      const original = (console as any)[method] as (...args: any[]) => void;

      // Ensure originalConsoleMethods is initialized
      if (!this.originalConsoleMethods) {
        this.originalConsoleMethods = {};
      }

      // Only patch if the original method exists
      if (typeof original === 'function') {
        this.originalConsoleMethods[method] = original;

        (console as any)[method] = (...args: any[]): void => {
          try {
            this.emitLog(method, args);
          } catch (emitErr) {
            rumLogger.error('Failed to emit console log record:', emitErr);
          }
          // Call the original console method so behavior is preserved
          original.apply(console, args);
        };
      }
    });
  }

  /**
   * Unpatches the console methods.
   */
  private unpatchConsole(): void {
    Object.entries(this.originalConsoleMethods).forEach(([method, original]) => {
      if (original) {
        (console as any)[method] = original;
      }
    });
    this.originalConsoleMethods = {};
  }

  /**
   * Emits a log record.
   */
  private emitLog(method: ConsoleMethod, args: unknown[]): void {
    // Skip logs from this library
    if (this.isRUMLibraryLog(args)) {
      return;
    }

    const severityNumber = this.mapSeverity(method);
    const body = this.formatBody(args);
    let attributes = {};

    if (method === 'error') {
      attributes = {
        [ATTR_CONSOLE_STACK_TRACE]: this.getStackTrace(),
      };
    }

    const newLog: LogRecord = {
      body,
      attributes: attributes,
    };

    newLog.severityText = method;
    if (severityNumber) newLog.severityNumber = severityNumber;

    this.logger.emit(newLog);
  }

  /**
   * Checks if the log arguments are from our own RUM library.
   * We identify RUM library logs by the '[logzio-rum]' prefix.
   */
  private isRUMLibraryLog(args: unknown[]): boolean {
    if (args.length === 0) return false;

    const firstArg = args[0];
    if (typeof firstArg !== 'string') return false;

    return firstArg.startsWith('[logzio-rum]');
  }

  /**
   * Returns the stack trace.
   */
  private getStackTrace(): string {
    try {
      const error = new Error();
      const stack = error.stack;

      if (!stack) return '';

      // Remove the first line (Error constructor) and filter out our instrumentation frames or common console wrapper patterns
      const stackLines = stack.split('\n').slice(1);
      const filteredStack = stackLines
        .filter((line) => {
          const trimmedLine = line.trim();
          return (
            !trimmedLine.includes('ConsoleLogsInstrumentation') &&
            !trimmedLine.includes('patchConsole') &&
            !trimmedLine.includes('emitLog')
          );
        })
        .slice(0, this.MAX_FRAMES); // Limit to first 10 frames to avoid excessive data

      return filteredStack.join('\n');
    } catch {
      return '';
    }
  }

  /**
   * Maps the severity.
   */
  private mapSeverity(method: ConsoleMethod): SeverityNumber {
    switch (method) {
      case 'error':
        return SeverityNumber.ERROR;
      case 'warn':
        return SeverityNumber.WARN;
      case 'debug':
        return SeverityNumber.DEBUG;
      case 'info':
        return SeverityNumber.INFO;
      case 'log':
        return SeverityNumber.INFO;
      default:
        return SeverityNumber.INFO;
    }
  }

  /**
   * Formats the body.
   */
  private formatBody(args: unknown[]): string {
    return args
      .map((arg) => {
        if (typeof arg === 'string') return arg;
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      })
      .join(' ');
  }
}
