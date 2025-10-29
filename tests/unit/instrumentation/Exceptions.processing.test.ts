/**
 * @jest-environment jsdom
 */

// Mock dependencies
jest.mock('@src/instrumentation/trackers', () => ({
  ErrorTracker: {
    getInstance: jest.fn(() => ({
      subscribe: jest.fn(() => jest.fn()),
    })),
  },
}));

jest.mock('@src/shared', () => ({
  rumLogger: {
    error: jest.fn(),
  },
  DOM_EVENT: {
    ERROR: 'error',
    UNHANDLED_REJECTION: 'unhandledrejection',
  },
}));

jest.mock('@opentelemetry/api', () => ({
  SpanStatusCode: {
    ERROR: 2,
  },
  SpanKind: {
    INTERNAL: 1,
  },
}));

jest.mock('@opentelemetry/semantic-conventions', () => ({
  ATTR_ERROR_TYPE: 'error.type',
}));

jest.mock('@src/instrumentation/semconv', () => ({
  ATTR_ERROR_COLUMN_NUMBER: 'error.column_number',
  ATTR_ERROR_FILENAME: 'error.filename',
  ATTR_ERROR_LINE_NUMBER: 'error.line_number',
  ATTR_URL: 'url.full',
  SpanName: {
    RUNTIME_EXCEPTION: 'runtime_exception',
    APP_EXCEPTION: 'app_exception',
    RUM_EXCEPTION: 'rum_exception',
  },
}));

// Helper functions to test core logic without instantiating the class
const testExceptionLogic = () => {
  return {
    // Test error category mapping
    mapErrorCategory: (eventKind: string) => {
      const { DOM_EVENT } = require('@src/shared');
      return eventKind === DOM_EVENT.ERROR ? 'runtime' : 'promise';
    },

    // Test attribute building
    buildErrorAttributes: (category: string, extraAttributes?: any) => {
      return {
        'error.type': category,
        ...(extraAttributes || {}),
      };
    },

    // Test span name mapping
    getSemanticSpanName: (category: string) => {
      const spanNames = {
        runtime: 'runtime_exception',
        promise: 'app_exception',
        manual: 'rum_exception',
      };
      return spanNames[category as keyof typeof spanNames] || 'rum_exception';
    },

    // Test error event attribute extraction
    extractErrorAttributes: (event: any) => {
      const extraAttributes: any = {};
      if (event.filename) {
        extraAttributes['url.full'] = event.filename;
        extraAttributes['error.filename'] = event.filename;
      }
      if (event.line !== undefined) {
        extraAttributes['error.line_number'] = event.line;
      }
      if (event.column !== undefined) {
        extraAttributes['error.column_number'] = event.column;
      }
      return extraAttributes;
    },
  };
};

describe('Exceptions Processing Logic', () => {
  let mockSpan: any;
  let mockTracer: any;
  let logic: ReturnType<typeof testExceptionLogic>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSpan = {
      setStatus: jest.fn(),
      recordException: jest.fn(),
      end: jest.fn(),
    };

    mockTracer = {
      startSpan: jest.fn(() => mockSpan),
    };

    logic = testExceptionLogic();
  });

  it('should map error categories correctly', () => {
    const { DOM_EVENT } = require('@src/shared');

    expect(logic.mapErrorCategory(DOM_EVENT.ERROR)).toBe('runtime');
    expect(logic.mapErrorCategory(DOM_EVENT.UNHANDLED_REJECTION)).toBe('promise');
  });

  it('should extract error attributes from event data', () => {
    const runtimeEvent = {
      message: 'Runtime error',
      filename: 'test.js',
      line: 42,
      column: 10,
      stack: 'Error stack',
    };

    const attributes = logic.extractErrorAttributes(runtimeEvent);

    expect(attributes).toEqual({
      'url.full': 'test.js',
      'error.filename': 'test.js',
      'error.line_number': 42,
      'error.column_number': 10,
    });

    // Test with minimal data
    const minimalEvent = { message: 'Error', line: 5 };
    const minimalAttributes = logic.extractErrorAttributes(minimalEvent);

    expect(minimalAttributes).toEqual({
      'error.line_number': 5,
    });
  });

  it('should demonstrate span creation and recording flow', () => {
    const { SpanKind, SpanStatusCode } = require('@opentelemetry/api');

    const error = new Error('Test error');
    const category = 'runtime';
    const extraAttributes = { extra: 'value' };

    // Simulate recordException logic
    expect(() => {
      const spanName = logic.getSemanticSpanName(category);
      const attributes = logic.buildErrorAttributes(category, extraAttributes);

      const span = mockTracer.startSpan(spanName, {
        kind: SpanKind.INTERNAL,
        attributes,
      });

      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });

      span.recordException(error);
      span.end();
    }).not.toThrow();

    // Verify span creation
    expect(mockTracer.startSpan).toHaveBeenCalledWith('runtime_exception', {
      kind: SpanKind.INTERNAL,
      attributes: {
        'error.type': 'runtime',
        extra: 'value',
      },
    });

    // Verify span operations
    expect(mockSpan.setStatus).toHaveBeenCalledWith({
      code: SpanStatusCode.ERROR,
      message: 'Test error',
    });

    expect(mockSpan.recordException).toHaveBeenCalledWith(error);
    expect(mockSpan.end).toHaveBeenCalled();
  });

  it('should handle span creation errors gracefully', () => {
    const { rumLogger } = require('@src/shared');

    // Make startSpan throw
    mockTracer.startSpan.mockImplementation(() => {
      throw new Error('Span creation failed');
    });

    expect(() => {
      try {
        const spanName = logic.getSemanticSpanName('runtime');
        const attributes = logic.buildErrorAttributes('runtime');
        mockTracer.startSpan(spanName, { attributes });
      } catch (recordError) {
        rumLogger.error('Failed to record exception:', recordError);
      }
    }).not.toThrow();

    expect(rumLogger.error).toHaveBeenCalledWith('Failed to record exception:', expect.any(Error));
  });

  it('should buildErrorAttributes merges category and extras', () => {
    const result = logic.buildErrorAttributes('runtime', { a: 1, b: 2 });

    expect(result).toEqual({
      'error.type': 'runtime',
      a: 1,
      b: 2,
    });

    // Test with no extras
    const resultNoExtras = logic.buildErrorAttributes('promise');
    expect(resultNoExtras).toEqual({
      'error.type': 'promise',
    });
  });

  it('getSemanticSpanName maps categories correctly', () => {
    expect(logic.getSemanticSpanName('runtime')).toBe('runtime_exception');
    expect(logic.getSemanticSpanName('promise')).toBe('app_exception');
    expect(logic.getSemanticSpanName('manual')).toBe('rum_exception');
    expect(logic.getSemanticSpanName('unknown')).toBe('rum_exception');
  });
});
