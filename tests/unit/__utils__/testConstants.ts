/**
 * Shared test constants to avoid repetition across test files
 */

// Prefer inline IDs per test. If you need a reusable pattern, consider:
// export const generateTestId = (name: string) => `test-${name}-${Date.now()}`;

export const TEST_TIMESTAMPS = {
  BASE: new Date('2023-01-01T00:00:00.000Z').getTime(),
  FUTURE: new Date('2023-01-01T00:01:00.000Z').getTime(),
  PAST: new Date('2022-12-31T23:59:00.000Z').getTime(),
} as const;

export const TEST_SERVICE = {
  NAME: 'test-service',
  VERSION: '1.0.0',
} as const;

export const TEST_URLS = {
  BASE: 'https://example.com',
  PAGE: 'https://example.com/page',
  API: 'https://api.example.com',
} as const;

export const TEST_ERRORS = {
  MESSAGE: 'Test error message',
  FILENAME: 'test.js',
  LINE: 42,
  COLUMN: 10,
  STACK: 'Error: Test error\n    at test.js:42:10',
} as const;

export const TEST_TOKENS = {
  TRACES: 'test-traces-token',
  METRICS: 'test-metrics-token',
  LOGS: 'test-logs-token',
} as const;
