/**
 * Creates a mock generateId function that returns a configurable value
 */
export const createGenerateIdMock = (returnValue: string = 'test-id-123') =>
  jest.fn(() => returnValue);

/**
 * Creates a mock LocalStorageStore with all required methods
 */
export const createLocalStorageMock = () => ({
  get: jest.fn(),
  set: jest.fn(),
  remove: jest.fn(),
});

/**
 * Creates a complete utils module mock with configurable values
 */
export const createUtilsMock = (generateIdValue?: string) => ({
  // Import actual utilities that don't need mocking first
  ...jest.requireActual('@src/utils'),
  // Override with mocks
  generateId: createGenerateIdMock(generateIdValue),
  LocalStorageStore: createLocalStorageMock(),
});

/**
 * For tests that only need generateId mock
 */
export const createGenerateIdOnlyMock = (returnValue?: string) => ({
  ...jest.requireActual('@src/utils'),
  generateId: createGenerateIdMock(returnValue),
});

/**
 * For tests that only need LocalStorageStore mock
 */
export const createLocalStorageOnlyMock = () => ({
  ...jest.requireActual('@src/utils'),
  LocalStorageStore: createLocalStorageMock(),
});
