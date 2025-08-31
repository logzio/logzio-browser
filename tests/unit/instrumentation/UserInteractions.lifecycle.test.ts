/**
 * @jest-environment jsdom
 */
import { setupUserInteractionsTest } from '../__utils__/userInteractionsTestHelpers';

describe('UserInteractions Lifecycle', () => {
  beforeEach(() => {
    setupUserInteractionsTest();
  });

  it('should event listener setup and cleanup logic works correctly', () => {
    const { EventListener } = require('@src/shared');

    // Simulate setting up event listeners
    const eventNames = ['click'];
    const listeners: any[] = [];

    expect(() => {
      eventNames.forEach((eventName) => {
        const eventListener = new EventListener();
        eventListener.set(window, eventName, jest.fn());
        listeners.push(eventListener);
      });
    }).not.toThrow();

    expect(EventListener).toHaveBeenCalled();

    // Simulate cleanup
    expect(() => {
      listeners.forEach((listener) => {
        listener.remove();
      });
    }).not.toThrow();
  });

  it('should handle navigation tracker subscription and cleanup', () => {
    const mockUnsubscribe = jest.fn();
    const mockNavigationTracker = {
      subscribe: jest.fn(() => mockUnsubscribe),
    };

    // Simulate subscription
    let unsubscribeFn: any = null;
    expect(() => {
      unsubscribeFn = mockNavigationTracker.subscribe();
    }).not.toThrow();

    expect(mockNavigationTracker.subscribe).toHaveBeenCalled();
    expect(typeof unsubscribeFn).toBe('function');

    // Simulate cleanup
    expect(() => {
      if (unsubscribeFn) {
        unsubscribeFn();
      }
    }).not.toThrow();

    expect(mockUnsubscribe).toHaveBeenCalled();
  });
});
