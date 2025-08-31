/**
 * @jest-environment jsdom
 */

import { NavigationEventType } from '@src/instrumentation/trackers/Navigation';
import {
  setupNavigationTest,
  historyApiMethods,
  navigationScenarios,
} from '../../__utils__/navigationTestHelpers';

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

describe('NavigationTracker History API', () => {
  let testSetup: ReturnType<typeof setupNavigationTest>;

  beforeEach(() => {
    testSetup = setupNavigationTest();
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  describe.each(historyApiMethods)('$name navigation', ({ execute, expectsEvents }) => {
    it('should emit events on URL change', () => {
      const tracker = testSetup.NavigationTracker.getInstance();
      tracker.init();

      const handler = jest.fn();
      tracker.subscribe(NavigationEventType.STARTED, handler);

      const oldUrl = window.location.href;
      execute('/new-path');

      if (expectsEvents) {
        expect(handler).toHaveBeenCalledWith({
          oldUrl,
          newUrl: window.location.href,
          timestamp: testSetup.mockTimestamp,
        });
      } else {
        expect(handler).not.toHaveBeenCalled();
      }
    });

    it('should not emit events when URL unchanged', () => {
      const tracker = testSetup.NavigationTracker.getInstance();
      tracker.init();

      const handler = jest.fn();
      tracker.subscribe(NavigationEventType.STARTED, handler);

      const currentUrl = window.location.href;
      execute(currentUrl);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe.each(navigationScenarios)('URL patterns: $description', ({ path }) => {
    it('should handle URL correctly', () => {
      const tracker = testSetup.NavigationTracker.getInstance();
      tracker.init();

      const handler = jest.fn();
      tracker.subscribe(NavigationEventType.STARTED, handler);

      window.history.pushState({}, '', path);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].newUrl).toContain(path.split('?')[0].split('#')[0]);
    });
  });

  it('should preserve original method functionality', () => {
    const tracker = testSetup.NavigationTracker.getInstance();
    tracker.init();

    // Test pushState returns undefined
    const pushResult = window.history.pushState({ test: 'data' }, 'Test', '/test');
    expect(pushResult).toBeUndefined();
    expect(window.location.href).toContain('/test');

    // Test replaceState returns undefined
    const replaceResult = window.history.replaceState(
      { test: 'replaced' },
      'Replaced',
      '/replaced',
    );
    expect(replaceResult).toBeUndefined();
    expect(window.location.href).toContain('/replaced');
  });

  it('should handle rapid navigation sequences', () => {
    const tracker = testSetup.NavigationTracker.getInstance();
    tracker.init();

    const handler = jest.fn();
    tracker.subscribe(NavigationEventType.STARTED, handler);

    const urls = ['/seq-1', '/seq-2', '/seq-3'];

    urls.forEach((url, index) => {
      if (index % 2 === 0) {
        window.history.pushState({}, '', url);
      } else {
        window.history.replaceState({}, '', url);
      }
    });

    expect(handler).toHaveBeenCalledTimes(3);

    // Verify URL progression
    urls.forEach((url, index) => {
      expect(handler.mock.calls[index][0].newUrl).toContain(url);
    });
  });

  it('should update currentUrl correctly', () => {
    const tracker = testSetup.NavigationTracker.getInstance();
    tracker.init();

    const initialUrl = tracker.getCurrentUrl();
    window.history.pushState({}, '', '/current-url-test');

    expect(tracker.getCurrentUrl()).not.toBe(initialUrl);
    expect(tracker.getCurrentUrl()).toBe(window.location.href);
    expect(tracker.getCurrentUrl()).toContain('/current-url-test');
  });
});
