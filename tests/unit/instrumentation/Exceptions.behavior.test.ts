// Mock minimal OTEL and internal modules before import
jest.mock('@opentelemetry/instrumentation', () => ({
  InstrumentationBase: class {
    enable() {}
    disable() {}
  },
}));

jest.mock('@opentelemetry/api', () => ({
  SpanKind: { INTERNAL: 'internal' },
  SpanStatusCode: { ERROR: 'error' },
}));

jest.mock('@src/shared', () => ({
  DOM_EVENT: { ERROR: 'error', UNHANDLED_REJECTION: 'unhandledrejection' },
  rumLogger: { error: jest.fn() },
}));

// Use real semantic-conventions from OTEL in assertions instead of mocking
import {
  ATTR_CODE_COLUMN_NUMBER,
  ATTR_CODE_FILE_PATH,
  ATTR_CODE_LINE_NUMBER,
  ATTR_URL_PATH,
} from '@opentelemetry/semantic-conventions';
import { ATTR_REQUEST_PATH } from '../../../src/instrumentation/semconv';

// Stub ErrorTracker singleton and capture subscribe callback
const subscribeMock = jest.fn();
let subscribedHandler: any = null;

jest.mock('@src/instrumentation/trackers', () => ({
  ErrorTracker: {
    getInstance: jest.fn(() => ({
      subscribe: (handler: any) => {
        subscribedHandler = handler;
        subscribeMock(handler);
        return () => {
          subscribedHandler = null;
        };
      },
    })),
  },
}));

describe('ErrorTrackingInstrumentation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    subscribedHandler = null;
  });

  function createFakeTracer() {
    const span = {
      setStatus: jest.fn(),
      recordException: jest.fn(),
      end: jest.fn(),
    };
    const tracer = {
      startSpan: jest.fn(() => span),
      _span: span,
    } as any;
    return tracer;
  }

  it('should enable subscribes and handles runtime error event', async () => {
    await jest.isolateModules(async () => {
      const { ErrorTrackingInstrumentation } = jest.requireActual(
        '@src/instrumentation/Exceptions',
      );
      const { DOM_EVENT } = require('@src/shared');

      const inst = new ErrorTrackingInstrumentation({} as any) as any;
      inst.tracer = createFakeTracer();

      expect(() => inst.enable()).not.toThrow();
      expect(subscribeMock).toHaveBeenCalled();

      // Simulate error event
      subscribedHandler({
        kind: DOM_EVENT.ERROR,
        message: 'boom',
        filename: 'https://app.example.com/index.js',
        line: 10,
        column: 20,
        stack: 'Error: boom\n at line',
      });

      const span = inst.tracer._span;
      expect(span.setStatus).toHaveBeenCalledWith({ code: 'error', message: 'boom' });
      expect(span.recordException).toHaveBeenCalled();
      expect(span.end).toHaveBeenCalled();

      const startArgs = inst.tracer.startSpan.mock.calls[0][1];
      expect(startArgs.kind).toBe('internal');
      expect(startArgs.attributes[ATTR_CODE_FILE_PATH]).toBe('https://app.example.com/index.js');
      expect(startArgs.attributes[ATTR_CODE_LINE_NUMBER]).toBe(10);
      expect(startArgs.attributes[ATTR_CODE_COLUMN_NUMBER]).toBe(20);
      expect(startArgs.attributes[ATTR_URL_PATH]).toBe(window.location.href);
      expect(startArgs.attributes[ATTR_REQUEST_PATH]).toBe(new URL(window.location.href).pathname);
    });
  });

  it('should handle unhandled rejection event', async () => {
    await jest.isolateModules(async () => {
      const { ErrorTrackingInstrumentation } = jest.requireActual(
        '@src/instrumentation/Exceptions',
      );
      const { DOM_EVENT } = require('@src/shared');

      const inst = new ErrorTrackingInstrumentation({} as any) as any;
      inst.tracer = createFakeTracer();
      inst.enable();

      subscribedHandler({ kind: DOM_EVENT.UNHANDLED_REJECTION, message: 'rejected!' });

      // Should have started a span and ended it
      expect(inst.tracer.startSpan).toHaveBeenCalled();
      expect(inst.tracer._span.end).toHaveBeenCalled();
    });
  });

  it('should disable unsubscribes without throwing', async () => {
    await jest.isolateModules(async () => {
      const { ErrorTrackingInstrumentation } = jest.requireActual(
        '@src/instrumentation/Exceptions',
      );

      const inst = new ErrorTrackingInstrumentation({} as any) as any;
      inst.tracer = createFakeTracer();

      inst.enable();
      expect(subscribedHandler).not.toBeNull();

      expect(() => inst.disable()).not.toThrow();
      // our unsubscribe sets handler back to null
      expect(subscribedHandler).toBeNull();
    });
  });

  it('should log error when recording exception fails but does not throw', async () => {
    await jest.isolateModules(async () => {
      const { ErrorTrackingInstrumentation } = jest.requireActual(
        '@src/instrumentation/Exceptions',
      );
      const { rumLogger, DOM_EVENT } = require('@src/shared');

      const inst = new ErrorTrackingInstrumentation({} as any) as any;
      const tracer = createFakeTracer();
      tracer.startSpan.mockImplementation(() => {
        throw new Error('tracer failure');
      });
      inst.tracer = tracer;

      inst.enable();

      expect(() => subscribedHandler({ kind: DOM_EVENT.ERROR, message: 'x' })).not.toThrow();
      expect(rumLogger.error).toHaveBeenCalled();
    });
  });
});
