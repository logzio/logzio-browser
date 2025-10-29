/**
 * @jest-environment jsdom
 */
import { setupErrorsTest, createErrorsSharedMocks } from '../../__utils__/errorsTestHelpers';

// Mock shared dependencies using centralized helper
jest.mock('@src/shared', () => createErrorsSharedMocks());

describe('ErrorTracker Component Interactions', () => {
  let testSetup: ReturnType<typeof setupErrorsTest>;

  beforeEach(() => {
    testSetup = setupErrorsTest();
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should integrate with EventListener system', () => {
    const { EventListener } = require('@src/shared');
    const tracker = testSetup.ErrorTracker.getInstance();

    const handler = jest.fn();
    tracker.subscribe(handler);

    // Should have created EventListener instances
    expect(EventListener).toHaveBeenCalled();

    // Should have called set method to register listeners
    const eventListenerInstance = EventListener.mock.results[0].value;
    expect(eventListenerInstance.set).toHaveBeenCalled();
  });

  it('should handle multiple subscribers in integrated scenario', () => {
    const tracker = testSetup.ErrorTracker.getInstance();

    const handlers = [jest.fn(), jest.fn(), jest.fn()];
    const unsubscribes = handlers.map((handler) => tracker.subscribe(handler));

    expect(unsubscribes).toHaveLength(3);

    // All unsubscribes should work
    unsubscribes.forEach((unsub) => {
      expect(() => unsub()).not.toThrow();
    });
  });

  it('should manage lifecycle correctly in integration', () => {
    const { EventListener } = require('@src/shared');
    const tracker = testSetup.ErrorTracker.getInstance();

    // Initial state - no EventListeners created
    const initialCallCount = EventListener.mock.calls.length;

    // Subscribe should trigger initialization
    const handler = jest.fn();
    const unsubscribe = tracker.subscribe(handler);

    expect(EventListener.mock.calls.length).toBeGreaterThan(initialCallCount);

    // Unsubscribe should work
    expect(() => unsubscribe()).not.toThrow();
  });

  it('should handle shutdown and reinitialization in integration', () => {
    const tracker = testSetup.ErrorTracker.getInstance();

    // First lifecycle
    const handler1 = jest.fn();
    const unsub1 = tracker.subscribe(handler1);
    unsub1(); // This should trigger shutdown

    // Second lifecycle should work
    const handler2 = jest.fn();
    const unsub2 = tracker.subscribe(handler2);

    expect(typeof unsub2).toBe('function');
    expect(() => unsub2()).not.toThrow();
  });

  it('should maintain singleton behavior in integration', () => {
    const tracker1 = testSetup.ErrorTracker.getInstance();
    const tracker2 = testSetup.ErrorTracker.getInstance();

    expect(tracker1).toBe(tracker2);

    // Operations on one should affect the other
    const handler = jest.fn();
    const unsubscribe = tracker1.subscribe(handler);

    // Both should reference the same state
    expect(() => unsubscribe()).not.toThrow();
  });

  it('should handle error conditions gracefully in integration', () => {
    const { EventListener } = require('@src/shared');
    const tracker = testSetup.ErrorTracker.getInstance();

    // Make EventListener throw
    EventListener.mockImplementationOnce(() => {
      throw new Error('EventListener failed');
    });

    // Should still work gracefully
    expect(() => tracker.subscribe(jest.fn())).not.toThrow();
  });

  it('should clean up resources properly in integration', () => {
    const { EventListener } = require('@src/shared');
    const tracker = testSetup.ErrorTracker.getInstance();

    const handler = jest.fn();
    const unsubscribe = tracker.subscribe(handler);

    // Get the EventListener instance
    const eventListenerInstance = EventListener.mock.results[0].value;

    // Unsubscribe should trigger cleanup
    unsubscribe();

    // Remove should have been called for cleanup
    expect(eventListenerInstance.remove).toHaveBeenCalled();
  });
});
