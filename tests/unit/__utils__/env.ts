/**
 * Environment setup helpers for tests
 */

/**
 * Standard beforeEach helper for resetting global state
 */
export function setupTestEnvironment() {
  // Clear all timers
  jest.clearAllTimers();

  // Reset any global state if needed
  // This is where we can add more global resets as the project grows
}

/**
 * Standard afterEach helper for cleanup
 */
export function cleanupTestEnvironment() {
  // Restore any global mocks
  jest.restoreAllMocks();

  // Clear any remaining timers
  jest.clearAllTimers();
}
