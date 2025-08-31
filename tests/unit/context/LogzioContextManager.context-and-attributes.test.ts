// Mock shared dependencies
jest.mock('@src/shared', () => ({
  rumLogger: {
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock OpenTelemetry API
const mockContext = {
  getValue: jest.fn((key) => {
    const keyStr = key.toString();
    if (keyStr.includes('session_id')) return 'test-session';
    if (keyStr.includes('view_id')) return 'test-view';
    if (keyStr.includes('custom_attributes')) return { 'custom.attr': 'value' };
    return undefined;
  }),
  setValue: jest.fn().mockImplementation((key, value) => ({
    ...mockContext,
    [`_${key.toString()}`]: value,
  })),
};

const mockTrace = {
  setSpan: jest.fn((context, span) => ({ ...context, _span: span })),
  getActiveSpan: jest.fn(),
};

jest.mock('@opentelemetry/api', () => ({
  createContextKey: jest.fn((name) => Symbol(name)),
  ROOT_CONTEXT: mockContext,
  trace: mockTrace,
}));

import { LogzioContextManager } from '../../../src/context/LogzioContextManager';

describe('LogzioContextManager context and attributes', () => {
  let manager: LogzioContextManager;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = LogzioContextManager.getInstance();

    // Reset internal state
    (manager as any)._currentContext = mockContext;
    (manager as any)._customAttributes = {};
  });

  afterEach(() => {
    manager.disable();
  });

  it('should flatten nested objects in setInitialCustomAttributes', () => {
    const nestedAttributes = {
      user: {
        id: '123',
        profile: {
          name: 'John',
          settings: {
            theme: 'dark',
          },
        },
      },
      simple: 'value',
    };

    manager.setInitialCustomAttributes(nestedAttributes);

    const currentAttributes = manager.getCurrentCustomAttributes();
    expect(currentAttributes).toEqual({
      'user.id': '123',
      'user.profile.name': 'John',
      'user.profile.settings.theme': 'dark',
      simple: 'value',
    });
  });

  it('should set active context with all values in setPageViewContext', () => {
    const mockSpan = { spanId: 'test-span' };
    const sessionId = 'session-123';
    const viewId = 'view-456';

    // Set some custom attributes first
    manager.setInitialCustomAttributes({ 'app.version': '1.0.0' });

    manager.setPageViewContext(mockSpan as any, sessionId, viewId);

    expect(mockContext.setValue).toHaveBeenCalledWith(
      expect.any(Symbol), // SESSION_ID_KEY
      sessionId,
    );
    expect(mockContext.setValue).toHaveBeenCalledWith(
      expect.any(Symbol), // VIEW_ID_KEY
      viewId,
    );
    expect(mockContext.setValue).toHaveBeenCalledWith(
      expect.any(Symbol), // PAGE_VIEW_SPAN_KEY
      mockSpan,
    );
    expect(mockTrace.setSpan).toHaveBeenCalledWith(expect.any(Object), mockSpan);
  });

  it('should update active context when span exists in setCustomAttributes', () => {
    const mockSpan = { spanId: 'active-span' };
    mockTrace.getActiveSpan.mockReturnValue(mockSpan);

    // Set up existing context
    manager.setPageViewContext(mockSpan as any, 'session-1', 'view-1');

    // Spy on setPageViewContext to see if it gets called again
    const setPageViewSpy = jest.spyOn(manager, 'setPageViewContext');

    manager.setCustomAttributes({ 'new.attr': 'new-value' });

    expect(setPageViewSpy).toHaveBeenCalledWith(mockSpan, 'test-session', 'test-view');
    expect(manager.getCurrentCustomAttributes()).toEqual({ 'new.attr': 'new-value' });
  });

  it('should be no-op when context is ROOT_CONTEXT in setCustomAttributes', () => {
    // Reset to ROOT_CONTEXT
    (manager as any)._currentContext = mockContext; // This represents ROOT_CONTEXT in our mock
    mockTrace.getActiveSpan.mockReturnValue(undefined);

    const setPageViewSpy = jest.spyOn(manager, 'setPageViewContext');

    manager.setCustomAttributes({ 'test.attr': 'value' });

    expect(setPageViewSpy).not.toHaveBeenCalled();
    expect(manager.getCurrentCustomAttributes()).toEqual({ 'test.attr': 'value' });
  });

  it('should preserve and restore context with() and bind()', () => {
    const originalContext = { original: true };
    const testContext = { test: true };
    (manager as any)._currentContext = originalContext;

    let capturedContext: any;
    const testFunction = () => {
      capturedContext = manager.active();
      return 'result';
    };

    // Test with()
    const result = manager.with(testContext as any, testFunction);

    expect(result).toBe('result');
    expect(capturedContext).toBe(testContext);
    expect(manager.active()).toBe(originalContext); // Restored

    // Test bind()
    const boundFunction = manager.bind(testContext as any, testFunction);

    // Execute bound function and verify it runs with bound context
    const currentContext = manager.active();

    // Bound function should execute with its bound context
    const boundResult = (boundFunction as any)();

    expect(boundResult).toBe('result');
    expect(manager.active()).toBe(currentContext); // Context restored after bound function
  });

  it('should return correct values from getters', () => {
    // Test getCurrentCustomAttributes returns a copy
    (manager as any)._customAttributes = { 'test.attr': 'value' };
    const attributes1 = manager.getCurrentCustomAttributes();
    const attributes2 = manager.getCurrentCustomAttributes();

    expect(attributes1).toEqual({ 'test.attr': 'value' });
    expect(attributes1).not.toBe(attributes2); // Different objects

    // Mutation safety
    attributes1['new.attr'] = 'new-value';
    expect(manager.getCurrentCustomAttributes()).toEqual({ 'test.attr': 'value' });

    // Test context getters
    expect(manager.getSessionId()).toBe('test-session');
    expect(manager.getViewId()).toBe('test-view');
    expect(manager.getCustomAttributes()).toEqual({ 'custom.attr': 'value' });

    // Test with provided context
    const customContext = {
      getValue: jest.fn().mockReturnValue('custom-value'),
    };
    expect(manager.getSessionId(customContext as any)).toBe('custom-value');
  });
});
