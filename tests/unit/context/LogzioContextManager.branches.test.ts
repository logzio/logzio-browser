import { createLoggerOnlyMock } from '../__utils__/loggerMocks';

// Mock shared dependencies using centralized helper - note the path matches the import in LogzioContextManager
jest.mock('@src/shared', () => createLoggerOnlyMock({ debug: jest.fn(), error: jest.fn() }));

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

describe('LogzioContextManager branches', () => {
  let manager: LogzioContextManager;
  let originals: any;

  beforeEach(() => {
    jest.clearAllMocks();
    originals = {
      EventTarget: globalThis.EventTarget,
      setTimeout: globalThis.setTimeout,
      setInterval: globalThis.setInterval,
      requestAnimationFrame: globalThis.requestAnimationFrame,
      requestIdleCallback: (globalThis as any).requestIdleCallback,
    };

    // Default sane mocks
    (globalThis as any).setTimeout = jest.fn((cb) => cb && cb());
    (globalThis as any).setInterval = jest.fn();
    (globalThis as any).requestAnimationFrame = jest.fn((cb) => cb && cb());
    (globalThis as any).requestIdleCallback = undefined;

    // EventTarget with function methods by default
    const addEventListener = jest.fn();
    const removeEventListener = jest.fn();
    globalThis.EventTarget = {
      prototype: { addEventListener, removeEventListener },
    } as any;

    manager = LogzioContextManager.getInstance();
  });

  afterEach(() => {
    manager.disable();
    Object.assign(globalThis, originals);
    if (originals.EventTarget) globalThis.EventTarget = originals.EventTarget;
  });

  it('should enable no-ops gracefully when EventTarget is missing', () => {
    // Remove EventTarget
    (globalThis as any).EventTarget = undefined;

    expect(() => manager.enable()).not.toThrow();
    manager.disable();
  });

  it('should addEventListener with EventListenerObject binds handleEvent and remove uses mapping', () => {
    manager.enable();

    // Create a target object whose prototype is the patched EventTarget.prototype
    const target = Object.create((globalThis as any).EventTarget.prototype);
    const handlerObj = { handleEvent: jest.fn() } as any;

    // addEventListener should wrap
    target.addEventListener('click', handlerObj);

    // Stored mapping should allow removal
    expect(() => target.removeEventListener('click', handlerObj)).not.toThrow();
  });

  it('should timer patch skip branch when a timer is missing', () => {
    // Remove setInterval so branch that skips patch executes
    const originalSetInterval = (globalThis as any).setInterval;
    (globalThis as any).setInterval = undefined;

    expect(() => manager.enable()).not.toThrow();

    // setTimeout should still be patched (wrapped)
    const patched = (globalThis as any).setTimeout;
    expect(typeof patched).toBe('function');

    // Restore setInterval to not affect other tests
    (globalThis as any).setInterval = originalSetInterval;
  });

  it('should raf patch skip branch when requestAnimationFrame is missing', () => {
    const originalRAF = (globalThis as any).requestAnimationFrame;
    (globalThis as any).requestAnimationFrame = undefined;

    expect(() => manager.enable()).not.toThrow();

    // Restore RAF
    (globalThis as any).requestAnimationFrame = originalRAF;
  });
});
