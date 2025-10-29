// Mock shared dependencies
jest.mock('@src/shared', () => ({
  rumLogger: {
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock OpenTelemetry API
const mockContext = {
  getValue: jest.fn(),
  setValue: jest.fn().mockImplementation((key, value) => ({
    ...mockContext,
    [`_${key.toString()}`]: value,
  })),
};

jest.mock('@opentelemetry/api', () => ({
  createContextKey: jest.fn((name) => Symbol(name)),
  ROOT_CONTEXT: mockContext,
  trace: {
    setSpan: jest.fn((context, span) => ({ ...context, _span: span })),
    getActiveSpan: jest.fn(),
  },
}));

import { LogzioContextManager } from '../../../src/context/LogzioContextManager';
import { rumLogger } from '../../../src/shared';

describe('LogzioContextManager lifecycle and patching', () => {
  let manager: LogzioContextManager;
  let originalGlobals: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Save original globals
    originalGlobals = {
      setTimeout: globalThis.setTimeout,
      setInterval: globalThis.setInterval,
      requestAnimationFrame: globalThis.requestAnimationFrame,
      requestIdleCallback: (globalThis as any).requestIdleCallback,
      EventTarget: globalThis.EventTarget,
    };

    // Mock globals
    (globalThis as any).setTimeout = jest.fn();
    (globalThis as any).setInterval = jest.fn();
    (globalThis as any).requestAnimationFrame = jest.fn();
    (globalThis as any).requestIdleCallback = jest.fn();

    // Mock EventTarget
    const mockAddEventListener = jest.fn();
    const mockRemoveEventListener = jest.fn();
    globalThis.EventTarget = {
      prototype: {
        addEventListener: mockAddEventListener,
        removeEventListener: mockRemoveEventListener,
      },
    } as any;

    manager = LogzioContextManager.getInstance();
  });

  afterEach(() => {
    // Disable manager to clean up
    manager.disable();

    // Restore original globals
    Object.assign(globalThis, originalGlobals);

    // Ensure EventTarget is properly restored
    if (originalGlobals.EventTarget) {
      globalThis.EventTarget = originalGlobals.EventTarget;
    }
  });

  it('should be idempotent and patches globals in enable()', () => {
    const originalSetTimeout = (globalThis as any).setTimeout;
    const originalAddEventListener = globalThis.EventTarget.prototype.addEventListener;

    // First enable
    manager.enable();

    expect((globalThis as any).setTimeout).not.toBe(originalSetTimeout);
    expect(globalThis.EventTarget.prototype.addEventListener).not.toBe(originalAddEventListener);
    expect(rumLogger.debug).toHaveBeenCalledWith('LogzioContextManager enabled successfully');

    // Second enable should be no-op
    jest.clearAllMocks();
    const patchedSetTimeout = (globalThis as any).setTimeout;

    manager.enable();

    expect((globalThis as any).setTimeout).toBe(patchedSetTimeout); // No change
    expect(rumLogger.debug).not.toHaveBeenCalled(); // No logging
  });

  it('should restore originals and reset state in disable()', () => {
    const originalSetTimeout = (globalThis as any).setTimeout;
    const originalAddEventListener = globalThis.EventTarget.prototype.addEventListener;

    manager.enable();

    // Verify patched
    expect((globalThis as any).setTimeout).not.toBe(originalSetTimeout);

    manager.disable();

    // Should restore originals
    expect((globalThis as any).setTimeout).toBe(originalSetTimeout);
    expect(globalThis.EventTarget.prototype.addEventListener).toBe(originalAddEventListener);
    expect(rumLogger.debug).toHaveBeenCalledWith('LogzioContextManager disabled successfully');
  });

  it('should not throw on enable when globals are missing', () => {
    // Test with missing requestIdleCallback (common scenario)
    const original = (globalThis as any).requestIdleCallback;
    (globalThis as any).requestIdleCallback = undefined;

    expect(() => manager.enable()).not.toThrow();
    expect(rumLogger.debug).toHaveBeenCalledWith('LogzioContextManager enabled successfully');

    // Restore
    (globalThis as any).requestIdleCallback = original;
  });

  it('should not throw on disable restore failure', () => {
    manager.enable();

    // Inject a failing restore function
    (manager as any)._originals.push(() => {
      throw new Error('restore failed');
    });

    expect(() => manager.disable()).not.toThrow();
    expect(rumLogger.error).toHaveBeenCalledWith(
      'Failed to disable LogzioContextManager',
      expect.any(Error),
    );
  });

  it('should bind timers to active context', () => {
    manager.enable();

    const capturedContext = { test: 'context' };
    (manager as any)._currentContext = capturedContext;

    let callbackContext: any;
    const callback = () => {
      callbackContext = manager.active();
    };

    // Call patched setTimeout
    ((globalThis as any).setTimeout as jest.Mock)(callback, 100);

    // Get the bound callback that was passed to original setTimeout
    const boundCallback = ((globalThis as any).setTimeout as jest.Mock).mock.calls[0][0];

    // Execute the bound callback
    boundCallback();

    expect(callbackContext).toBe(capturedContext);
  });

  it('should bind requestAnimationFrame to active context', () => {
    manager.enable();

    const capturedContext = { test: 'raf-context' };
    (manager as any)._currentContext = capturedContext;

    let callbackContext: any;
    const callback = () => {
      callbackContext = manager.active();
    };

    // Call patched requestAnimationFrame
    ((globalThis as any).requestAnimationFrame as jest.Mock)(callback);

    // Get the bound callback
    const boundCallback = ((globalThis as any).requestAnimationFrame as jest.Mock).mock.calls[0][0];

    // Execute the bound callback
    boundCallback();

    expect(callbackContext).toBe(capturedContext);
  });

  it('enable and disable should work without throwing', () => {
    // Verify enable/disable operations don't throw
    expect(() => {
      manager.enable();
      manager.disable();
      manager.enable();
      manager.disable();
    }).not.toThrow();

    // Verify manager has basic methods available
    expect(typeof manager.enable).toBe('function');
    expect(typeof manager.disable).toBe('function');
    expect(typeof manager.active).toBe('function');
    expect(typeof manager.with).toBe('function');
    expect(typeof manager.bind).toBe('function');
  });
});
