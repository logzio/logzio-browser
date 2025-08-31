/**
 * @jest-environment jsdom
 */

import { EventMonitor } from '@src/utils/EventCounter';
import { DOM_EVENT } from '@src/shared';

// Mock shared dependencies
jest.mock('@src/shared', () => ({
  rumLogger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
  DOM_EVENT: {
    ERROR: 'error',
    UNHANDLED_REJECTION: 'unhandledrejection',
    CLICK: 'click',
    SCROLL: 'scroll',
    KEYDOWN: 'keydown',
  },
  EventListener: jest.fn().mockImplementation(() => ({
    set: jest.fn(),
    remove: jest.fn(),
  })),
}));

// Mock ErrorTracker
jest.mock('@src/instrumentation/trackers', () => ({
  ErrorTracker: {
    getInstance: jest.fn(() => ({
      subscribe: jest.fn(() => jest.fn()), // Returns unsubscribe function
    })),
  },
}));

describe('EventMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should track error events and returns count on stop', () => {
    const { ErrorTracker } = require('@src/instrumentation/trackers');
    let errorHandler: any;

    ErrorTracker.getInstance.mockReturnValue({
      subscribe: jest.fn((handler) => {
        errorHandler = handler;
        return jest.fn(); // unsubscribe function
      }),
    });

    const monitor = new EventMonitor();

    // Simulate error events
    errorHandler({ message: 'Error 1' });
    errorHandler({ message: 'Error 2' });
    errorHandler({ message: 'Error 3' });

    const counters = monitor.stop();

    expect(counters.errors).toBe(3);
    expect(counters.activities).toBeUndefined();
  });

  it('should track activity events when configured', () => {
    const { EventListener } = require('@src/shared');
    let activityHandler: any;

    EventListener.mockImplementation(() => ({
      set: jest.fn((_target, _event, handler) => {
        activityHandler = handler;
      }),
      remove: jest.fn(),
    }));

    const monitor = new EventMonitor([DOM_EVENT.CLICK, DOM_EVENT.SCROLL]);

    // Simulate activity events
    activityHandler();
    activityHandler();

    const counters = monitor.stop();

    expect(counters.activities).toBe(2);
    expect(counters.errors).toBe(0);
  });

  it('should filter out error events from activity tracking', () => {
    const { EventListener } = require('@src/shared');

    new EventMonitor([DOM_EVENT.CLICK, DOM_EVENT.ERROR, DOM_EVENT.UNHANDLED_REJECTION]);

    // Should only set up listeners for non-error events
    expect(EventListener).toHaveBeenCalledTimes(1); // Only for CLICK
  });

  it('should handle initialization errors gracefully', () => {
    const { ErrorTracker } = require('@src/instrumentation/trackers');
    const { rumLogger } = require('@src/shared');

    ErrorTracker.getInstance.mockImplementation(() => {
      throw new Error('ErrorTracker failed');
    });

    expect(() => new EventMonitor()).not.toThrow();
    expect(rumLogger.error).toHaveBeenCalledWith(
      'Event counter failed to start error tracking: ',
      expect.any(Error),
    );
  });
});
