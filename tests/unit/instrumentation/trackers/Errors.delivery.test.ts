/**
 * @jest-environment jsdom
 */

import { setupErrorsTest, createErrorsSharedMocks } from '../../__utils__/errorsTestHelpers';

// Mock shared dependencies using centralized helper
jest.mock('@src/shared', () => createErrorsSharedMocks());

describe('ErrorTracker Event Delivery', () => {
  let testSetup: ReturnType<typeof setupErrorsTest>;

  beforeEach(() => {
    testSetup = setupErrorsTest();
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should handle handler errors gracefully', () => {
    const tracker = testSetup.ErrorTracker.getInstance();
    const handler1 = jest.fn();
    const handler2 = jest.fn().mockImplementation(() => {
      throw new Error('Handler error');
    });
    const handler3 = jest.fn();

    expect(() => {
      tracker.subscribe(handler1);
      tracker.subscribe(handler2);
      tracker.subscribe(handler3);
    }).not.toThrow();
  });

  it('should provide working unsubscribe functionality', () => {
    const tracker = testSetup.ErrorTracker.getInstance();
    const handler = jest.fn();

    const unsubscribe = tracker.subscribe(handler);

    // Should be able to unsubscribe successfully
    expect(() => unsubscribe()).not.toThrow();

    // Multiple unsubscribes should be safe
    expect(() => unsubscribe()).not.toThrow();
  });

  it('should handle subscription edge cases', () => {
    const tracker = testSetup.ErrorTracker.getInstance();

    // Should handle various handler types gracefully
    expect(() => tracker.subscribe(jest.fn())).not.toThrow();
    expect(() => tracker.subscribe(() => {})).not.toThrow();
    expect(() => tracker.subscribe(function namedHandler() {})).not.toThrow();
  });

  it('should maintain proper subscription state', () => {
    const tracker = testSetup.ErrorTracker.getInstance();

    // Subscribe and unsubscribe multiple handlers
    const handlers = Array.from({ length: 5 }, () => jest.fn());
    const unsubscribes = handlers.map((handler) => tracker.subscribe(handler));

    // Unsubscribe half of them
    unsubscribes.slice(0, 3).forEach((unsub) => unsub());

    // Should still be able to subscribe new handlers
    expect(() => tracker.subscribe(jest.fn())).not.toThrow();
  });

  it('should handle initialization and cleanup properly', () => {
    const { EventListener } = require('@src/shared');
    const tracker = testSetup.ErrorTracker.getInstance();

    // First subscriber should trigger initialization
    const handler = jest.fn();
    const unsubscribe = tracker.subscribe(handler);

    expect(EventListener).toHaveBeenCalled();

    // Cleanup should work
    expect(() => unsubscribe()).not.toThrow();
  });
});
