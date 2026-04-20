import { InstrumentationBase, InstrumentationConfig } from '@opentelemetry/instrumentation';
import { LogRecord, SeverityNumber } from '@opentelemetry/api-logs';
import { rumLogger } from '../shared';
import { ATTR_CONSOLE_STACK_TRACE } from './semconv';

// Cache encoder/decoder instances to avoid re-allocation on every log
const textEncoder = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;

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
  private static readonly MAX_LOG_SIZE_BYTES = 500_000; // 500KB
  private static readonly MAX_STACK_BYTES = 50_000; // 50KB

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
   * Returns the stack trace with size limits.
   */
  private getStackTrace(): string {
    try {
      const error = new Error();
      const stack = error.stack;

      if (!stack) return '';

      // Remove the first line (Error constructor) and filter out our instrumentation frames
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
        .slice(0, this.MAX_FRAMES);

      const fullStack = filteredStack.join('\n');
      return this.truncateUtf8(fullStack, ConsoleLogsInstrumentation.MAX_STACK_BYTES);
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
   * Formats the body with byte limit to prevent excessive log sizes.
   */
  private formatBody(args: unknown[]): string {
    return this.buildBodyWithLimit(args, ConsoleLogsInstrumentation.MAX_LOG_SIZE_BYTES);
  }

  /**
   * Builds log body respecting byte limits to prevent memory issues.
   */
  private buildBodyWithLimit(args: unknown[], limitBytes: number): string {
    const parts: string[] = [];
    let used = 0;

    for (let i = 0; i < args.length; i++) {
      const s = this.safeStringify(args[i]);
      const sep = i === 0 ? '' : ' ';
      const sepLen = this.utf8Len(sep);
      const sLen = this.utf8Len(s);

      if (used + sepLen + sLen <= limitBytes) {
        parts.push(sep + s);
        used += sepLen + sLen;
      } else {
        const remaining = Math.max(0, limitBytes - used - sepLen);
        if (remaining > 0) {
          parts.push(sep + this.truncateUtf8(s, remaining));
        }
        break;
      }
    }

    return parts.join('');
  }

  /**
   * Safely stringifies values, handling circular references and errors.
   */
  private safeStringify(arg: unknown): string {
    if (typeof arg === 'string') return arg;
    if (arg === undefined) return 'undefined';
    if (arg === null) return 'null';

    try {
      const seen = new WeakSet();
      return JSON.stringify(arg, function (_key, value) {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        return value;
      });
    } catch {
      try {
        return String(arg);
      } catch {
        return '[Unserializable]';
      }
    }
  }

  /**
   * Gets UTF-8 byte length of a string.
   */
  private utf8Len(str: string): number {
    if (textEncoder) {
      return textEncoder.encode(str).length;
    }
    return str.length; // Fallback for older browsers
  }

  /**
   * Truncates string to specified byte limit with clear indication.
   */
  private truncateUtf8(str: string, limitBytes: number): string {
    if (textEncoder && textDecoder) {
      const bytes = textEncoder.encode(str);

      if (bytes.length <= limitBytes) return str;

      // For small limits, just truncate without suffix to avoid confusion
      if (limitBytes < 20) {
        const truncatedBytes = bytes.slice(0, limitBytes);
        return textDecoder.decode(truncatedBytes);
      }

      const suffix = '... [truncated]';
      const suffixBytes = textEncoder.encode(suffix).length;
      const availableBytes = Math.max(0, limitBytes - suffixBytes);

      const truncatedBytes = bytes.slice(0, availableBytes);
      return textDecoder.decode(truncatedBytes) + suffix;
    } else {
      // Fallback for older browsers
      if (limitBytes < 20) {
        return str.substring(0, limitBytes);
      }
      const suffix = '... [truncated]';
      const availableChars = Math.max(0, limitBytes - suffix.length);
      return str.slice(0, availableChars) + suffix;
    }
  }
}
