import { SessionContextLogProcessor } from '@src/openTelemetry/processors/SessionContextLogProcessor';
import { ATTR_SESSION_ID, ATTR_VIEW_ID } from '@src/instrumentation/semconv';

// Mock LogzioContextManager
jest.mock('@src/context/LogzioContextManager', () => ({
  rumContextManager: {
    active: jest.fn(() => ({})),
    getSessionId: jest.fn(),
    getViewId: jest.fn(),
    getCustomAttributes: jest.fn(),
  },
}));

// Get reference to mocked rumContextManager
const { rumContextManager: mockContextManager } = require('@src/context/LogzioContextManager');

describe('SessionContextLogProcessor', () => {
  let processor: SessionContextLogProcessor;
  let mockSessionManager: any;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new SessionContextLogProcessor();

    // Create mock session manager
    mockSessionManager = {
      getSessionId: jest.fn().mockReturnValue('test-session-id'),
      getActiveView: jest
        .fn()
        .mockReturnValue({ id: 'test-view-id', url: 'http://test.com', startedAt: Date.now() }),
    };

    // Set the session manager on the processor
    processor.setSessionManager(mockSessionManager);

    // Default mock returns for context manager
    mockContextManager.getSessionId.mockReturnValue('test-session-id');
    mockContextManager.getViewId.mockReturnValue('test-view-id');
    mockContextManager.getCustomAttributes.mockReturnValue({ 'user.id': 'user-123' });
  });

  it('should be instantiated', () => {
    expect(processor).toBeInstanceOf(SessionContextLogProcessor);
    expect(typeof processor.onEmit).toBe('function');
    expect(typeof processor.forceFlush).toBe('function');
    expect(typeof processor.shutdown).toBe('function');
  });

  it('should handle log record processing without throwing', () => {
    const mockLogRecord = {
      attributes: {} as any,
      setAttribute: jest.fn((key, value) => {
        (mockLogRecord.attributes as any)[key] = value;
      }),
    };

    expect(() => processor.onEmit(mockLogRecord as any)).not.toThrow();

    // Should have called setAttribute for session and view
    expect(mockLogRecord.setAttribute).toHaveBeenCalledWith(ATTR_SESSION_ID, 'test-session-id');
    expect(mockLogRecord.setAttribute).toHaveBeenCalledWith(ATTR_VIEW_ID, 'test-view-id');
    expect(mockLogRecord.setAttribute).toHaveBeenCalledWith('user.id', 'user-123');
  });

  it('should not override existing attributes', () => {
    const mockLogRecord = {
      attributes: {
        [ATTR_SESSION_ID]: 'existing-session',
        [ATTR_VIEW_ID]: 'existing-view',
      },
      setAttribute: jest.fn(),
    };

    processor.onEmit(mockLogRecord as any);

    // Should not have called setAttribute for existing attributes
    expect(mockLogRecord.setAttribute).not.toHaveBeenCalledWith(ATTR_SESSION_ID, expect.anything());
    expect(mockLogRecord.setAttribute).not.toHaveBeenCalledWith(ATTR_VIEW_ID, expect.anything());

    // But should still set custom attributes
    expect(mockLogRecord.setAttribute).toHaveBeenCalledWith('user.id', 'user-123');
  });

  it('should handle session manager values correctly', () => {
    // Mock session manager instead of context manager
    mockSessionManager.getSessionId.mockReturnValue('custom-session');
    mockSessionManager.getActiveView.mockReturnValue({
      id: 'custom-view',
      url: 'http://test.com',
      startedAt: Date.now(),
    });
    mockContextManager.getCustomAttributes.mockReturnValue({
      'metric.value': 42,
      'flag.enabled': true,
    });

    const mockLogRecord = {
      attributes: {},
      setAttribute: jest.fn(),
    };

    processor.onEmit(mockLogRecord as any);

    expect(mockLogRecord.setAttribute).toHaveBeenCalledWith(ATTR_SESSION_ID, 'custom-session');
    expect(mockLogRecord.setAttribute).toHaveBeenCalledWith(ATTR_VIEW_ID, 'custom-view');
    expect(mockLogRecord.setAttribute).toHaveBeenCalledWith('metric.value', '42');
    expect(mockLogRecord.setAttribute).toHaveBeenCalledWith('flag.enabled', 'true');
  });

  it('should handle undefined session manager values gracefully', () => {
    // Mock session manager to return undefined values
    mockSessionManager.getSessionId.mockReturnValue(undefined);
    mockSessionManager.getActiveView.mockReturnValue(null);
    mockContextManager.getCustomAttributes.mockReturnValue(undefined);

    const mockLogRecord = {
      attributes: {},
      setAttribute: jest.fn(),
    };

    expect(() => processor.onEmit(mockLogRecord as any)).not.toThrow();

    // Should not have called setAttribute for undefined values
    expect(mockLogRecord.setAttribute).not.toHaveBeenCalled();
  });

  it('lifecycle methods should work correctly', () => {
    expect(processor.forceFlush()).resolves.toBeUndefined();
    expect(processor.shutdown()).resolves.toBeUndefined();
  });

  it('should handle empty custom attributes gracefully', () => {
    mockContextManager.getCustomAttributes.mockReturnValue({});

    const mockLogRecord = {
      attributes: {},
      setAttribute: jest.fn(),
    };

    expect(() => processor.onEmit(mockLogRecord as any)).not.toThrow();

    // Should still set session and view but no custom attributes
    expect(mockLogRecord.setAttribute).toHaveBeenCalledWith(ATTR_SESSION_ID, 'test-session-id');
    expect(mockLogRecord.setAttribute).toHaveBeenCalledWith(ATTR_VIEW_ID, 'test-view-id');
    expect(mockLogRecord.setAttribute).toHaveBeenCalledTimes(2);
  });
});
