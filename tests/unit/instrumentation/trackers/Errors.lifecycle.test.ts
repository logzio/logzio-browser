/**
 * @jest-environment jsdom
 */

import { setupErrorsTest, createErrorsSharedMocks } from '../../__utils__/errorsTestHelpers';

// Mock shared dependencies using centralized helper
jest.mock('@src/shared', () => createErrorsSharedMocks());

describe('ErrorTracker Lifecycle', () => {
  let testSetup: ReturnType<typeof setupErrorsTest>;

  beforeEach(() => {
    testSetup = setupErrorsTest();
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should initialize automatically on first subscribe', () => {
    const { EventListener } = require('@src/shared');
    const tracker = testSetup.ErrorTracker.getInstance();

    const handler = jest.fn();
    tracker.subscribe(handler);

    expect(EventListener).toHaveBeenCalled();
  });

  it('should not re-initialize on subsequent subscribes', () => {
    const { EventListener } = require('@src/shared');
    const tracker = testSetup.ErrorTracker.getInstance();

    tracker.subscribe(jest.fn());
    const callCountAfterFirst = EventListener.mock.calls.length;

    tracker.subscribe(jest.fn());
    tracker.subscribe(jest.fn());

    expect(EventListener.mock.calls.length).toBe(callCountAfterFirst);
  });

  it('should track multiple subscribers independently', () => {
    const tracker = testSetup.ErrorTracker.getInstance();

    const handler1 = jest.fn();
    const handler2 = jest.fn();
    const handler3 = jest.fn();

    const unsub1 = tracker.subscribe(handler1);
    const unsub2 = tracker.subscribe(handler2);
    const unsub3 = tracker.subscribe(handler3);

    // All should be different unsubscribe functions
    expect(unsub1).not.toBe(unsub2);
    expect(unsub2).not.toBe(unsub3);
    expect(unsub1).not.toBe(unsub3);
  });

  it('should support subscription and unsubscription lifecycle', () => {
    const tracker = testSetup.ErrorTracker.getInstance();

    const handler = jest.fn();
    const unsubscribe = tracker.subscribe(handler);

    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });

  it('should handle reinitialization after all subscribers unsubscribe', () => {
    const tracker = testSetup.ErrorTracker.getInstance();

    // First lifecycle
    const unsub1 = tracker.subscribe(jest.fn());
    unsub1(); // Triggers shutdown

    // Second lifecycle
    const handler2 = jest.fn();
    const unsub2 = tracker.subscribe(handler2);

    expect(unsub2).toBeDefined();
    expect(typeof unsub2).toBe('function');
  });

  it('should handle edge cases gracefully', () => {
    const tracker = testSetup.ErrorTracker.getInstance();

    // Multiple unsubscribes should be idempotent
    const unsub = tracker.subscribe(jest.fn());
    unsub();
    expect(() => unsub()).not.toThrow();

    // Subscribing same handler multiple times
    const handler = jest.fn();
    const unsub1 = tracker.subscribe(handler);
    const unsub2 = tracker.subscribe(handler);

    // Should handle duplicate subscriptions gracefully
    expect(typeof unsub1).toBe('function');
    expect(typeof unsub2).toBe('function');
  });
});
