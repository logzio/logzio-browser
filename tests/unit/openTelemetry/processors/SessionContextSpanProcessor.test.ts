import { SessionContextSpanProcessor } from '@src/openTelemetry/processors/SessionContextSpanProcessor';
import { ATTR_SESSION_ID, ATTR_VIEW_ID } from '@src/instrumentation/semconv';
import {
  setupProcessorsTest,
  createMockSpan,
  sessionContextScenarios,
} from '../../__utils__/processorsTestHelpers';

// Mock LogzioContextManager
jest.mock('@src/context/LogzioContextManager', () => ({
  rumContextManager: {
    getSessionId: jest.fn(),
    getViewId: jest.fn(),
    getCustomAttributes: jest.fn(),
  },
}));

// Get reference to mocked rumContextManager
const { rumContextManager: mockContextManager } = require('@src/context/LogzioContextManager');

describe('SessionContextSpanProcessor', () => {
  let processor: SessionContextSpanProcessor;
  let testSetup: ReturnType<typeof setupProcessorsTest>;

  beforeEach(() => {
    testSetup = setupProcessorsTest();
    processor = new SessionContextSpanProcessor();

    // Default mock returns
    mockContextManager.getSessionId.mockReturnValue('test-session-id');
    mockContextManager.getViewId.mockReturnValue('test-view-id');
    mockContextManager.getCustomAttributes.mockReturnValue({ 'user.id': 'user-123' });
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  describe('onStart', () => {
    it('should add session and view IDs when missing', () => {
      const span = createMockSpan({ attributes: {} });

      processor.onStart(span, {} as any);

      expect(span.setAttribute).toHaveBeenCalledWith(ATTR_SESSION_ID, 'test-session-id');
      expect(span.setAttribute).toHaveBeenCalledWith(ATTR_VIEW_ID, 'test-view-id');
      expect(span.setAttribute).toHaveBeenCalledWith('user.id', 'user-123');
    });

    it('should not override existing session and view IDs', () => {
      const span = createMockSpan({
        attributes: {
          [ATTR_SESSION_ID]: 'existing-session',
          [ATTR_VIEW_ID]: 'existing-view',
        },
      });

      processor.onStart(span, {} as any);

      expect(span.setAttribute).not.toHaveBeenCalledWith(ATTR_SESSION_ID, expect.anything());
      expect(span.setAttribute).not.toHaveBeenCalledWith(ATTR_VIEW_ID, expect.anything());
      expect(span.setAttribute).toHaveBeenCalledWith('user.id', 'user-123');
    });

    it('should convert custom attribute values to strings', () => {
      mockContextManager.getCustomAttributes.mockReturnValue({
        'user.id': 123,
        'is.premium': true,
        score: null,
        metadata: { nested: 'object' },
      });

      const span = createMockSpan({ attributes: {} });

      processor.onStart(span, {} as any);

      expect(span.setAttribute).toHaveBeenCalledWith(ATTR_SESSION_ID, 'test-session-id');
      expect(span.setAttribute).toHaveBeenCalledWith(ATTR_VIEW_ID, 'test-view-id');
      expect(span.setAttribute).toHaveBeenCalledWith('user.id', '123');
      expect(span.setAttribute).toHaveBeenCalledWith('is.premium', 'true');
      expect(span.setAttribute).toHaveBeenCalledWith('score', 'null');
      expect(span.setAttribute).toHaveBeenCalledWith('metadata', '[object Object]');
    });

    describe.each(sessionContextScenarios)('context scenario: $name', ({ sessionId, viewId }) => {
      it('should handle context values correctly', () => {
        mockContextManager.getSessionId.mockReturnValue(sessionId);
        mockContextManager.getViewId.mockReturnValue(viewId);
        mockContextManager.getCustomAttributes.mockReturnValue({});

        const span = createMockSpan({ attributes: {} });

        expect(() => processor.onStart(span, {} as any)).not.toThrow();

        if (sessionId) {
          expect(span.setAttribute).toHaveBeenCalledWith(ATTR_SESSION_ID, sessionId);
        } else {
          expect(span.setAttribute).not.toHaveBeenCalledWith(ATTR_SESSION_ID, expect.anything());
        }

        if (viewId) {
          expect(span.setAttribute).toHaveBeenCalledWith(ATTR_VIEW_ID, viewId);
        } else {
          expect(span.setAttribute).not.toHaveBeenCalledWith(ATTR_VIEW_ID, expect.anything());
        }
      });
    });

    it('should handle undefined custom attributes gracefully', () => {
      mockContextManager.getCustomAttributes.mockReturnValue(undefined);

      const span = createMockSpan({ attributes: {} });

      expect(() => processor.onStart(span, {} as any)).not.toThrow();

      expect(span.setAttribute).toHaveBeenCalledWith(ATTR_SESSION_ID, 'test-session-id');
      expect(span.setAttribute).toHaveBeenCalledWith(ATTR_VIEW_ID, 'test-view-id');
    });
  });

  describe('lifecycle methods', () => {
    it('onEnd should be a no-op', () => {
      const span = createMockSpan();

      expect(() => processor.onEnd(span)).not.toThrow();
      expect(mockContextManager.getSessionId).not.toHaveBeenCalled();
    });

    it('forceFlush and shutdown should return resolved promises', async () => {
      await expect(processor.forceFlush()).resolves.toBeUndefined();
      await expect(processor.shutdown()).resolves.toBeUndefined();
    });
  });
});
