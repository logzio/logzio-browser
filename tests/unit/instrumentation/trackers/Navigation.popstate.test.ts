/**
 * @jest-environment jsdom
 */

import { NavigationEventType } from '@src/instrumentation/trackers/Navigation';
import { setupNavigationTest, dispatchPopstateEvent } from '../../__utils__/navigationTestHelpers';

// Mock shared dependencies
jest.mock('@src/shared', () => ({
  rumLogger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
  DOM_EVENT: {
    POP_STATE: 'popstate',
    PUSH_STATE: 'pushState',
    REPLACE_STATE: 'replaceState',
    GO: 'go',
    BACK: 'back',
    FORWARD: 'forward',
  },
  EventListener: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    remove: jest.fn(),
  })),
}));

describe('NavigationTracker Popstate Events', () => {
  let testSetup: ReturnType<typeof setupNavigationTest>;

  beforeEach(() => {
    testSetup = setupNavigationTest();
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should emit events when URL changes with popstate', () => {
    const tracker = testSetup.NavigationTracker.getInstance();
    tracker.init();

    const handler = jest.fn();
    tracker.subscribe(NavigationEventType.STARTED, handler);

    const oldUrl = window.location.href;

    // Change URL and dispatch popstate
    window.history.pushState({}, '', '/popstate-path');
    dispatchPopstateEvent();

    expect(handler).toHaveBeenCalledWith({
      oldUrl,
      newUrl: window.location.href,
      timestamp: testSetup.mockTimestamp,
    });
  });

  it('should not emit events when URL unchanged with popstate', () => {
    const tracker = testSetup.NavigationTracker.getInstance();
    tracker.init();

    const handler = jest.fn();
    tracker.subscribe(NavigationEventType.STARTED, handler);

    // Dispatch popstate without changing URL
    dispatchPopstateEvent();

    expect(handler).not.toHaveBeenCalled();
  });

  it('should handle rapid popstate events correctly', () => {
    const tracker = testSetup.NavigationTracker.getInstance();
    tracker.init();

    const handler = jest.fn();
    tracker.subscribe(NavigationEventType.STARTED, handler);

    // Multiple popstate events without URL change
    dispatchPopstateEvent();
    dispatchPopstateEvent();
    dispatchPopstateEvent();

    expect(handler).not.toHaveBeenCalled();

    // URL change + popstate
    window.history.pushState({}, '', '/rapid-change');
    dispatchPopstateEvent();

    expect(handler).toHaveBeenCalledTimes(1);

    // More popstate events without URL change
    dispatchPopstateEvent();
    dispatchPopstateEvent();

    expect(handler).toHaveBeenCalledTimes(1); // Still only 1
  });

  it('should update currentUrl correctly after popstate', () => {
    const tracker = testSetup.NavigationTracker.getInstance();
    tracker.init();

    const initialUrl = tracker.getCurrentUrl();

    // Change URL and dispatch popstate
    window.history.pushState({}, '', '/popstate-current-url');
    dispatchPopstateEvent();

    const updatedUrl = tracker.getCurrentUrl();

    expect(updatedUrl).not.toBe(initialUrl);
    expect(updatedUrl).toBe(window.location.href);
    expect(updatedUrl).toContain('/popstate-current-url');
  });

  it('should produce correct event sequence for rapid URL changes', () => {
    const tracker = testSetup.NavigationTracker.getInstance();
    tracker.init();

    const handler = jest.fn();
    tracker.subscribe(NavigationEventType.STARTED, handler);

    const urls = ['/rapid-1', '/rapid-2', '/rapid-3'];

    urls.forEach((url) => {
      window.history.pushState({}, '', url);
      dispatchPopstateEvent();
    });

    expect(handler).toHaveBeenCalledTimes(3);

    // Verify the sequence of URLs
    urls.forEach((url, index) => {
      expect(handler.mock.calls[index][0].newUrl).toContain(url);
    });
  });
});
