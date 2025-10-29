import {
  NavigationTracker,
  NavigationEventType,
} from '../../../../src/instrumentation/trackers/Navigation';
import { setupNavigationTest } from '../../__utils__/navigationTestHelpers';
import { setupTestEnvironment, cleanupTestEnvironment } from '../../__utils__/env';

// Mock shared dependencies - use factory function to avoid hoisting issues
jest.mock('@src/shared', () => {
  const { createNavigationSharedMock } = require('../../__utils__/navigationTestHelpers');
  return createNavigationSharedMock();
});

describe('NavigationTracker - Duplicate Events Prevention', () => {
  let tracker: NavigationTracker;
  let cleanup: () => void;

  beforeEach(() => {
    setupTestEnvironment();
    NavigationTracker.shutdown(); // ensure clean singleton

    // Setup navigation test environment
    const testSetup = setupNavigationTest();
    tracker = testSetup.NavigationTracker.getInstance();
    cleanup = testSetup.cleanup;
  });

  afterEach(() => {
    cleanup();
    NavigationTracker.shutdown(); // restore history methods
    cleanupTestEnvironment();
  });

  it('should handle init() idempotently (no double patch)', () => {
    // Set initial URL
    history.replaceState({}, '', '/');

    // Call init multiple times
    tracker.init();
    tracker.init();
    tracker.init();

    const handler = jest.fn();
    const unsub = tracker.subscribe(NavigationEventType.STARTED, handler);

    // Trigger navigation event via history API
    history.pushState({}, '', '/new-page');

    // Should only be called once despite multiple init calls
    expect(handler).toHaveBeenCalledTimes(1);

    unsub();
  });

  it('should not emit events when URL does not change', () => {
    // Set initial URL
    history.replaceState({}, '', '/same-page');

    tracker.init();
    const handler = jest.fn();
    const unsub = tracker.subscribe(NavigationEventType.STARTED, handler);

    // Navigation to same URL (no change, should not emit)
    history.pushState({}, '', '/same-page');

    // Should not be called since URL didn't change
    expect(handler).toHaveBeenCalledTimes(0);

    // Now navigate to a different URL (should emit)
    history.pushState({}, '', '/different-page');

    // Should be called once for the actual navigation
    expect(handler).toHaveBeenCalledTimes(1);

    unsub();
  });

  it('should emit separate events for different URLs', () => {
    // Set initial URL
    history.replaceState({}, '', '/');

    tracker.init();
    const handler = jest.fn();
    const unsub = tracker.subscribe(NavigationEventType.STARTED, handler);

    // First navigation
    history.pushState({}, '', '/page1');

    // Second navigation to different URL
    history.pushState({}, '', '/page2');

    // Should be called twice for two different navigations
    expect(handler).toHaveBeenCalledTimes(2);

    // Verify the event data structure (we can't predict exact timestamps)
    expect(handler).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        oldUrl: expect.stringContaining('/'),
        newUrl: expect.stringContaining('/page1'),
        timestamp: expect.any(Number),
      }),
    );
    expect(handler).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        oldUrl: expect.stringContaining('/page1'),
        newUrl: expect.stringContaining('/page2'),
        timestamp: expect.any(Number),
      }),
    );

    unsub();
  });
});
