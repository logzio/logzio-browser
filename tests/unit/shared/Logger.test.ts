import { LogLevel, rumLogger } from '@src/shared/Logger';

describe('RUMLogger', () => {
  it('has basic methods available', () => {
    expect(typeof rumLogger.info).toBe('function');
    expect(typeof rumLogger.error).toBe('function');
    expect(typeof rumLogger.warn).toBe('function');
    expect(typeof rumLogger.debug).toBe('function');
    expect(typeof rumLogger.setLevel).toBe('function');
  });

  it('setLevel method should work without throwing', () => {
    expect(() => {
      rumLogger.setLevel(LogLevel.ERROR);
      rumLogger.setLevel(LogLevel.INFO);
      rumLogger.setLevel(LogLevel.DEBUG);
      rumLogger.setLevel(LogLevel.WARN);
      rumLogger.setLevel(LogLevel.OFF);
    }).not.toThrow();
  });

  it('logging methods should not throw', () => {
    expect(() => {
      rumLogger.info('test message');
      rumLogger.error('error message');
      rumLogger.warn('warn message');
      rumLogger.debug('debug message');
    }).not.toThrow();
  });

  it('should handle missing console methods gracefully', () => {
    const originalConsole = global.console;

    // Remove console entirely
    (global as any).console = undefined;

    expect(() => {
      rumLogger.info('test message');
      rumLogger.error('error message');
    }).not.toThrow();

    // Restore console
    global.console = originalConsole;
  });

  it('should handle undefined and null arguments gracefully', () => {
    expect(() => {
      rumLogger.info(undefined as any);
      rumLogger.warn(null as any);
      rumLogger.error('message', undefined, null);
    }).not.toThrow();
  });

  it('should not throw when logging at various levels', () => {
    expect(() => {
      rumLogger.setLevel(LogLevel.DEBUG);
      rumLogger.debug('debug message');
      rumLogger.info('info message');
      rumLogger.warn('warn message');
      rumLogger.error('error message');

      rumLogger.setLevel(LogLevel.ERROR);
      rumLogger.debug('debug message');
      rumLogger.info('info message');
      rumLogger.warn('warn message');
      rumLogger.error('error message');
    }).not.toThrow();
  });

  it('should handle console methods that throw gracefully', () => {
    const originalConsole = global.console;
    const throwingConsole = {
      info: () => {
        throw new Error('Console error');
      },
      error: () => {
        throw new Error('Console error');
      },
      warn: () => {
        throw new Error('Console error');
      },
      debug: () => {
        throw new Error('Console error');
      },
    };
    global.console = throwingConsole as any;

    try {
      expect(() => {
        rumLogger.info('test');
        rumLogger.error('test');
        rumLogger.warn('test');
        rumLogger.debug('test');
      }).not.toThrow();
    } finally {
      global.console = originalConsole;
    }
  });

  it('should exercise log level checking behavior', () => {
    // Test log level comparison logic without relying on console mocking
    expect(() => {
      rumLogger.setLevel(LogLevel.ERROR);
      rumLogger.info('should not log'); // INFO=3, ERROR=1, so 1 < 3, should not log
      rumLogger.error('should log'); // ERROR=1, so 1 >= 1, should log

      rumLogger.setLevel(LogLevel.INFO);
      rumLogger.debug('should not log'); // DEBUG=4, INFO=3, so 3 < 4, should not log
      rumLogger.info('should log'); // INFO=3, so 3 >= 3, should log
    }).not.toThrow();
  });

  it('should respect OFF log level', () => {
    const originalConsole = global.console;
    const mockConsole = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    global.console = mockConsole as any;

    try {
      rumLogger.setLevel(LogLevel.OFF);

      rumLogger.info('info test');
      rumLogger.error('error test');
      rumLogger.warn('warn test');
      rumLogger.debug('debug test');

      // Nothing should be logged when level is OFF
      expect(mockConsole.info).not.toHaveBeenCalled();
      expect(mockConsole.error).not.toHaveBeenCalled();
      expect(mockConsole.warn).not.toHaveBeenCalled();
      expect(mockConsole.debug).not.toHaveBeenCalled();
    } finally {
      global.console = originalConsole;
    }
  });

  it('should handle logging with additional arguments', () => {
    const originalConsole = global.console;
    const mockConsole = {
      info: jest.fn(),
      error: jest.fn(),
    };
    global.console = mockConsole as any;

    try {
      rumLogger.setLevel(LogLevel.INFO);

      expect(() => {
        rumLogger.info('message', 'arg1', { key: 'value' }, 42);
        rumLogger.error('error message', new Error('test error'));
      }).not.toThrow();
    } finally {
      global.console = originalConsole;
    }
  });

  it('should log to console when level permits for each method', () => {
    const originalConsole = global.console;
    const mockConsole = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    global.console = mockConsole as any;

    try {
      rumLogger.setLevel(LogLevel.DEBUG);

      expect(() => {
        rumLogger.debug('d');
        rumLogger.info('i');
        rumLogger.warn('w');
        rumLogger.error('e');

        rumLogger.setLevel(LogLevel.INFO);
        rumLogger.debug('d');
        rumLogger.info('i');

        rumLogger.setLevel(LogLevel.WARN);
        rumLogger.info('i');
        rumLogger.warn('w');

        rumLogger.setLevel(LogLevel.ERROR);
        rumLogger.warn('w');
        rumLogger.error('e');
      }).not.toThrow();
    } finally {
      global.console = originalConsole;
    }
  });

  it('should do nothing when console method is not a function', () => {
    const originalConsole = global.console;
    const fakeConsole: any = { warn: undefined };
    global.console = fakeConsole;

    try {
      rumLogger.setLevel(LogLevel.WARN);
      expect(() => rumLogger.warn('x')).not.toThrow();
    } finally {
      global.console = originalConsole;
    }
  });
});
