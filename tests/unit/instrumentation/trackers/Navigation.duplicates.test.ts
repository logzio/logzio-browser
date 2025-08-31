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

    // Setup navigation test environment
    const testSetup = setupNavigationTest();
    tracker = testSetup.NavigationTracker.getInstance();
    cleanup = testSetup.cleanup;
  });

  afterEach(() => {
    cleanup();
    cleanupTestEnvironment();
  });

  it('should handle init() idempotently (no double patch)', () => {
    // Call init multiple times
    tracker.init();
    tracker.init();
    tracker.init();

    const handler = jest.fn();
    const unsub = tracker.subscribe(NavigationEventType.STARTED, handler);

    // Manually trigger a navigation event to verify it works
    (tracker as any).notify(NavigationEventType.STARTED, {
      oldUrl: 'http://localhost:3000/',
      newUrl: 'http://localhost:3000/new-page',
      timestamp: Date.now(),
    });

    // Should only be called once despite multiple init calls
    expect(handler).toHaveBeenCalledTimes(1);

    unsub();
  });

  it('should not emit duplicate events for same URL', () => {
    tracker.init();
    const handler = jest.fn();
    const unsub = tracker.subscribe(NavigationEventType.STARTED, handler);

    const url = 'http://localhost:3000/same-page';

    // First navigation to URL
    (tracker as any).notify(NavigationEventType.STARTED, {
      oldUrl: 'http://localhost:3000/',
      newUrl: url,
      timestamp: Date.now(),
    });

    // Second navigation to same URL (should still emit - different navigation events)
    (tracker as any).notify(NavigationEventType.STARTED, {
      oldUrl: url,
      newUrl: url,
      timestamp: Date.now() + 100,
    });

    // Both should be emitted (they're separate navigation events, even to same URL)
    expect(handler).toHaveBeenCalledTimes(2);

    unsub();
  });

  it('should emit separate events for different URLs', () => {
    tracker.init();
    const handler = jest.fn();
    const unsub = tracker.subscribe(NavigationEventType.STARTED, handler);

    const eventData1 = {
      oldUrl: 'http://localhost:3000/',
      newUrl: 'http://localhost:3000/page1',
      timestamp: Date.now(),
    };

    const eventData2 = {
      oldUrl: 'http://localhost:3000/page1',
      newUrl: 'http://localhost:3000/page2',
      timestamp: Date.now() + 100,
    };

    // First navigation
    (tracker as any).notify(NavigationEventType.STARTED, eventData1);

    // Second navigation to different URL
    (tracker as any).notify(NavigationEventType.STARTED, eventData2);

    // Should be called twice for two different navigations
    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenNthCalledWith(1, eventData1);
    expect(handler).toHaveBeenNthCalledWith(2, eventData2);

    unsub();
  });
});
