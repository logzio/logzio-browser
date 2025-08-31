export enum LogLevel {
  DEBUG = 4,
  INFO = 3,
  WARN = 2,
  ERROR = 1,
  OFF = 0,
}

/**
 * This class represents the RUM logger.
 * It provides methods to log messages at different levels.
 */
class RUMLogger {
  private level: LogLevel = LogLevel.INFO;

  /**
   * Sets the log level.
   * @param level - The log level to set.
   */
  public setLevel(level: LogLevel): void {
    this.level = level;
  }

  /**
   * Logs an info message.
   * @param message - The message to log.
   * @param args - The arguments to log.
   */
  public info(message: string, ...args: any[]): void {
    if (this.level >= LogLevel.INFO) {
      this.log('info', '[INFO]', message, args);
    }
  }

  /**
   * Logs a warning message.
   * @param message - The message to log.
   * @param args - The arguments to log.
   */
  public warn(message: string, ...args: any[]): void {
    if (this.level >= LogLevel.WARN) {
      this.log('warn', '[WARN]', message, args);
    }
  }

  /**
   * Logs an error message.
   * @param message - The message to log.
   * @param args - The arguments to log.
   */
  public error(message: string, ...args: any[]): void {
    if (this.level >= LogLevel.ERROR) {
      this.log('error', '[ERROR]', message, args);
    }
  }

  /**
   * Logs a debug message.
   * @param message - The message to log.
   * @param args - The arguments to log.
   */
  public debug(message: string, ...args: any[]): void {
    if (this.level >= LogLevel.DEBUG) {
      this.log('debug', '[DEBUG]', message, args);
    }
  }

  /**
   * Helper method to safely log messages to console.
   * @param level - The console method to use.
   * @param prefix - The log level prefix.
   * @param message - The message to log.
   * @param args - The arguments to log.
   */
  private log(
    level: 'info' | 'warn' | 'error' | 'debug',
    prefix: string,
    message: string,
    args: any[],
  ): void {
    try {
      if (typeof console?.[level] === 'function') {
        console[level](`[logzio-rum] ${prefix} ${message}`, ...args);
      }
    } catch (_error) {
      // Silently absorb any errors from the console API to prevent them from propagating and breaking the host application
    }
  }
}

export const rumLogger = new RUMLogger();
