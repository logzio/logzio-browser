/**
 * @jest-environment jsdom
 */

import { createSharedMock } from '../../__utils__/loggerMocks';

// Mock shared dependencies
jest.mock('@src/shared', () => createSharedMock({ error: jest.fn(), warn: jest.fn() }));

import { NavigationEventType, NavigationTracker } from '@src/instrumentation/trackers/Navigation';
import { setupNavigationTest } from '../../__utils__/navigationTestHelpers';

/**
 * Verifies navigation behavior across popstate/pushState and URL changes.
 */
describe('NavigationTracker - behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupNavigationTest();
  });

  it('should notify subscribers on navigation events', () => {
    const tracker = NavigationTracker.getInstance();
    tracker.init();
    const handler = jest.fn();
    const unsubscribe = tracker.subscribe(NavigationEventType.STARTED, handler);
    // Trigger programmatic navigation which the tracker patches
    window.history.pushState({}, '', '/nav-behavior-test');
    expect(handler).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('should expose STARTED/ENDED event types', () => {
    expect(NavigationEventType.STARTED).toBeDefined();
    expect(NavigationEventType.ENDED).toBeDefined();
  });

  // Other span-specific assertions moved out since tracker no longer manages spans directly
});
