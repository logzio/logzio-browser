// Mock OpenTelemetry instrumentation
jest.mock('@opentelemetry/instrumentation', () => ({
  InstrumentationBase: class {
    constructor() {}
    enable() {}
    disable() {}
  },
}));

// Mock shared dependencies
jest.mock('@src/shared', () => ({
  rumLogger: {
    error: jest.fn(),
  },
}));

// Mock semconv
jest.mock('@src/instrumentation/semconv', () => ({
  ATTR_CONSOLE_STACK_TRACE: 'console.stack_trace',
}));

import { ConsoleLogsInstrumentation } from '@src/instrumentation/ConsoleLogs';
import { rumLogger } from '@src/shared';

describe('ConsoleLogsInstrumentation Lifecycle', () => {
  let instrumentation: ConsoleLogsInstrumentation;
  let originalConsoleMethods: Record<string, any>;

  beforeAll(() => {
    // Save original console methods before any Jest spying
    originalConsoleMethods = {
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug,
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
    instrumentation = new ConsoleLogsInstrumentation({});
    (instrumentation as any).logger = { emit: jest.fn() };
  });

  afterEach(() => {
    // Ensure console is restored
    instrumentation.disable();
    jest.restoreAllMocks();
  });

  it('should patch console methods on enable and restore on disable', () => {
    // Enable instrumentation
    instrumentation.enable();

    // Console methods should be patched (different from originals)
    expect(console.log).not.toBe(originalConsoleMethods.log);
    expect(console.info).not.toBe(originalConsoleMethods.info);

    // Call console methods
    console.log('test log');
    console.info('test info');
    console.warn('test warn');
    console.error('test error');
    console.debug('test debug');

    // Should emit logs
    expect((instrumentation as any).logger.emit).toHaveBeenCalledTimes(5);

    // Disable instrumentation
    instrumentation.disable();

    // Console methods should be restored
    expect(console.log).toBe(originalConsoleMethods.log);
    expect(console.info).toBe(originalConsoleMethods.info);
    expect(console.warn).toBe(originalConsoleMethods.warn);
    expect(console.error).toBe(originalConsoleMethods.error);
    expect(console.debug).toBe(originalConsoleMethods.debug);
  });

  it('should skip logs emitted by RUM logger via prefix', () => {
    instrumentation.enable();

    // Call with RUM logger prefix
    console.info('[logzio-rum] internal message');

    // Should not emit log (RUM library logs are filtered out)
    expect((instrumentation as any).logger.emit).not.toHaveBeenCalled();
  });

  it('should log and not throw when patching fails', () => {
    jest.spyOn(instrumentation as any, 'patchConsole').mockImplementation(() => {
      throw new Error('patch failed');
    });

    expect(() => instrumentation.enable()).not.toThrow();
    expect(rumLogger.error).toHaveBeenCalledWith(
      'Failed to enable console logs instrumentation:',
      expect.any(Error),
    );
  });

  it('should log and not throw when unpatching fails', () => {
    instrumentation.enable();

    jest.spyOn(instrumentation as any, 'unpatchConsole').mockImplementation(() => {
      throw new Error('unpatch failed');
    });

    expect(() => instrumentation.disable()).not.toThrow();
    expect(rumLogger.error).toHaveBeenCalledWith(
      'Failed to disable console logs instrumentation:',
      expect.any(Error),
    );
  });
});
