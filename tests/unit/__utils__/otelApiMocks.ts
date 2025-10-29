/**
 * Centralized OpenTelemetry API mocks for tests that need minimal OTEL presence.
 * Keeps mocks lightweight and consistent across tests.
 */

export const createOtelApiMock = () => {
  const actual = jest.requireActual('@opentelemetry/api');
  return {
    ...actual,
    // Provide minimal diag and log level to satisfy core packages
    DiagLogLevel: actual.DiagLogLevel ?? {
      NONE: 0,
      ERROR: 30,
      WARN: 50,
      INFO: 60,
      DEBUG: 70,
      VERBOSE: 80,
      ALL: 9999,
    },
    diag: {
      setLogger: jest.fn(),
      createComponentLogger: jest.fn(() => ({
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      })),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    createContextKey: actual.createContextKey || jest.fn(() => Symbol('context-key')),
    metrics: {
      getMeter: jest.fn(),
    },
  };
};
