/**
 * Creates a mock rumLogger with all required methods
 */
export const createRumLoggerMock = () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  setLevel: jest.fn(),
});
/**
 * Returns a full mock of @src/shared with real constants and mocked behaviors.
 * Use with: jest.mock(`@src/shared`, () => createSharedMock())
 */
export const createSharedMock = (loggerOverrides: any = {}) => ({
  // Keep real constants and non-behavioral exports
  ...jest.requireActual('@src/shared'),
  // Override only behavioral pieces
  rumLogger: {
    ...createRumLoggerMock(),
    ...loggerOverrides,
  },
  EventListener: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    remove: jest.fn(),
  })),
});

/**
 * Returns a module with real constants and only the rumLogger mocked.
 * Use with: jest.mock(`@src/shared`, () => createLoggerOnlyMock({ warn: jest.fn() }))
 */
export const createLoggerOnlyMock = (overrides: any = {}) => ({
  ...jest.requireActual('@src/shared'),
  rumLogger: {
    ...createRumLoggerMock(),
    ...overrides,
  },
});
