/**
 * @jest-environment jsdom
 */

// Mock OpenTelemetry dependencies
jest.mock('@opentelemetry/api', () => ({
  trace: {
    getTracer: jest.fn(() => ({
      startSpan: jest.fn(() => ({
        end: jest.fn(),
      })),
    })),
  },
}));

jest.mock('@opentelemetry/instrumentation-user-interaction', () => ({
  AttributeNames: {
    EVENT_TYPE: 'user_interaction.event_type',
    HTTP_URL: 'http.url',
  },
}));

jest.mock('@src/shared', () => ({
  LOGZIO_RUM_PROVIDER_NAME: 'logzio-rum',
}));

jest.mock('@src/context/LogzioContextManager', () => ({
  rumContextManager: {
    setPageViewContext: jest.fn(),
  },
}));

jest.mock('@src/instrumentation/semconv', () => ({
  ATTR_SESSION_ID: 'session.id',
  ATTR_VIEW_ID: 'view.id',
  SpanName: {
    NAVIGATION: 'Navigation',
  },
}));

import { PageViewInstrumentation } from '@src/instrumentation/PageView';

describe('PageView Instrumentation', () => {
  let pageView: PageViewInstrumentation;
  let mockTracer: any;
  let mockSpan: any;

  beforeEach(() => {
    jest.clearAllMocks();

    const { trace } = require('@opentelemetry/api');

    mockSpan = {
      end: jest.fn(),
    };

    mockTracer = {
      startSpan: jest.fn(() => mockSpan),
    };

    trace.getTracer.mockReturnValue(mockTracer);

    pageView = new PageViewInstrumentation();
  });

  it('should construct tracer with provider name', () => {
    const { trace } = require('@opentelemetry/api');
    const { LOGZIO_RUM_PROVIDER_NAME } = require('@src/shared');

    expect(trace.getTracer).toHaveBeenCalledWith(LOGZIO_RUM_PROVIDER_NAME);
  });

  it('should start span with required attributes', () => {
    const sessionId = 'test-session-id';
    const viewId = 'test-view-id';

    pageView.startPageViewSpans(sessionId, viewId);

    expect(mockTracer.startSpan).toHaveBeenCalledWith('navigation', {
      attributes: {
        'session.id': sessionId,
        'view.id': viewId,
        'user_interaction.event_type': 'navigation',
        'http.url': expect.any(String), // Don't assert exact URL, just that it's included
      },
    });
  });

  it('should set page view context', () => {
    const { rumContextManager } = require('@src/context/LogzioContextManager');
    const sessionId = 'test-session-id';
    const viewId = 'test-view-id';

    pageView.startPageViewSpans(sessionId, viewId);

    expect(rumContextManager.setPageViewContext).toHaveBeenCalledWith(mockSpan, sessionId, viewId);
  });

  it('should end previous active span before starting new one', () => {
    const firstSpan = { end: jest.fn() };
    const secondSpan = { end: jest.fn() };

    mockTracer.startSpan.mockReturnValueOnce(firstSpan).mockReturnValueOnce(secondSpan);

    // Start first span
    pageView.startPageViewSpans('session1', 'view1');

    // Start second span - should end first span
    pageView.startPageViewSpans('session2', 'view2');

    expect(firstSpan.end).toHaveBeenCalledTimes(1);
    expect(mockTracer.startSpan).toHaveBeenCalledTimes(2);
  });

  it('should end active span and clears it', () => {
    // Start a span first
    pageView.startPageViewSpans('test-session', 'test-view');

    // End the span
    pageView.endPageViewSpan();

    expect(mockSpan.end).toHaveBeenCalledTimes(1);

    // Subsequent calls should not throw or call end again
    expect(() => pageView.endPageViewSpan()).not.toThrow();
    expect(mockSpan.end).toHaveBeenCalledTimes(1);
  });

  it('should be safe when no active span', () => {
    // Call endPageViewSpan without starting any span
    expect(() => pageView.endPageViewSpan()).not.toThrow();

    // Verify no span methods were called
    expect(mockSpan.end).not.toHaveBeenCalled();
  });

  it('should tolerate multiple sequential calls', () => {
    const span1 = { end: jest.fn() };
    const span2 = { end: jest.fn() };

    mockTracer.startSpan.mockReturnValueOnce(span1).mockReturnValueOnce(span2);

    // Multiple start/end cycles
    expect(() => {
      pageView.startPageViewSpans('session1', 'view1');
      pageView.endPageViewSpan();
      pageView.startPageViewSpans('session2', 'view2');
      pageView.endPageViewSpan();
    }).not.toThrow();

    // Each span should be ended exactly once
    expect(span1.end).toHaveBeenCalledTimes(1);
    expect(span2.end).toHaveBeenCalledTimes(1);
  });
});
