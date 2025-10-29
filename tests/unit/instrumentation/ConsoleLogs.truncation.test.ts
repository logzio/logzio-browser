// Mock dependencies
jest.mock('@opentelemetry/api-logs', () => ({
  logs: {
    getLogger: jest.fn(() => ({
      emit: jest.fn(),
    })),
  },
  SeverityNumber: {
    DEBUG: 5,
    INFO: 9,
    WARN: 13,
    ERROR: 17,
  },
}));

jest.mock('@src/shared', () => ({
  rumLogger: {
    error: jest.fn(),
  },
  LOGZIO_RUM_PROVIDER_NAME: 'logzio-rum',
}));

import { ConsoleLogsInstrumentation } from '@src/instrumentation/ConsoleLogs';

describe('ConsoleLogsInstrumentation - Truncation', () => {
  let instrumentation: ConsoleLogsInstrumentation;

  beforeEach(() => {
    instrumentation = new ConsoleLogsInstrumentation({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('helper methods', () => {
    it('should calculate UTF-8 byte length correctly', () => {
      // Test the utf8Len helper method by accessing it through reflection
      const utf8Len = (instrumentation as any).utf8Len;

      expect(utf8Len('hello')).toBe(5); // ASCII

      // Check if TextEncoder is available in test environment
      const hasTextEncoder = typeof TextEncoder !== 'undefined';
      if (hasTextEncoder) {
        expect(utf8Len('🚀')).toBe(4); // 4-byte emoji (rocket)
        expect(utf8Len('café')).toBe(5); // é is 2 bytes
      } else {
        // Fallback to string length in test environment
        expect(utf8Len('🚀')).toBe(2); // string length fallback
        expect(utf8Len('café')).toBe(4); // string length fallback
      }

      expect(utf8Len('')).toBe(0); // empty string
    });

    it('should truncate UTF-8 strings safely', () => {
      const truncateUtf8 = (instrumentation as any).truncateUtf8;

      // Test ASCII truncation - small limits don't add suffix
      expect(truncateUtf8('hello world', 5)).toBe('hello');

      // Test UTF-8 truncation - should not break multi-byte characters
      const emojiString = '🚀🚀🚀'; // 12 bytes total (3 rockets) or 6 chars fallback
      const hasTextEncoder = typeof TextEncoder !== 'undefined';

      if (hasTextEncoder) {
        expect(truncateUtf8(emojiString, 8)).toBe('🚀🚀'); // Should fit 2 emojis (8 bytes)
        expect(truncateUtf8(emojiString, 6)).toBe('🚀'); // Should fit 1 emoji (4 bytes)
      } else {
        // In fallback mode, each emoji is 2 chars
        expect(truncateUtf8(emojiString, 4)).toBe('🚀🚀'); // Should fit 2 emojis (4 chars)
        expect(truncateUtf8(emojiString, 2)).toBe('🚀'); // Should fit 1 emoji (2 chars)
      }

      // Test larger truncation with suffix
      const longString = 'a'.repeat(100);
      const truncated = truncateUtf8(longString, 50);
      expect(truncated.length).toBeLessThanOrEqual(50);
      expect(truncated).toContain('... [truncated]');
    });

    it('should safely stringify objects', () => {
      const safeStringify = (instrumentation as any).safeStringify;

      // Normal object
      expect(safeStringify({ key: 'value' })).toBe('{"key":"value"}');

      // Circular reference
      const circular: any = { name: 'test' };
      circular.self = circular;
      const result = safeStringify(circular);
      expect(result).toContain('[Circular]');

      // Unserializable object
      const unserializable = {
        toJSON() {
          throw new Error('Cannot serialize');
        },
      };
      expect(safeStringify(unserializable)).toBe('[object Object]');

      // Primitive values
      expect(safeStringify('string')).toBe('string');
      expect(safeStringify(123)).toBe('123');
      expect(safeStringify(true)).toBe('true');
      expect(safeStringify(null)).toBe('null');
      expect(safeStringify(undefined)).toBe('undefined');
    });

    it('should build body with byte limit', () => {
      const buildBodyWithLimit = (instrumentation as any).buildBodyWithLimit.bind(instrumentation);

      // Small args should not be truncated
      const smallResult = buildBodyWithLimit(['hello', 'world'], 1000);
      expect(smallResult).toBe('hello world');

      // Large args should be truncated
      const largeString = 'a'.repeat(600);
      const truncatedResult = buildBodyWithLimit([largeString], 500);
      expect(truncatedResult.length).toBeLessThanOrEqual(520); // 500 + truncation suffix
      expect(truncatedResult).toContain('... [truncated]');

      // Multiple args with limit
      const multiResult = buildBodyWithLimit(['x'.repeat(300), 'y'.repeat(300)], 500);
      expect(multiResult.length).toBeLessThanOrEqual(520);
      expect(multiResult).toContain('x');
    });
  });

  describe('stack trace handling', () => {
    it('should handle stack trace generation safely', () => {
      const getStackTrace = (instrumentation as any).getStackTrace.bind(instrumentation);

      const stackTrace = getStackTrace();
      expect(typeof stackTrace).toBe('string');

      // Should filter out instrumentation frames
      expect(stackTrace).not.toContain('ConsoleLogsInstrumentation');
      expect(stackTrace).not.toContain('patchConsole');
      expect(stackTrace).not.toContain('emitLog');
    });

    it('should truncate stack traces to byte limit', () => {
      const truncateUtf8 = (instrumentation as any).truncateUtf8;

      const longStack = 'at function1\\n'.repeat(10000); // Create very long stack
      const truncated = truncateUtf8(longStack, 50_000);

      expect(truncated.length).toBeLessThanOrEqual(50_020); // 50KB + truncation suffix
      if (truncated.length > 50_000) {
        expect(truncated).toContain('... [truncated]');
      }
    });
  });
});
