/**
 * @jest-environment jsdom
 */

import { EventListener } from '@src/shared/EventListener';
import { DOM_EVENT } from '@src/shared';

// Mock rumLogger
jest.mock('@src/shared/Logger', () => ({
  rumLogger: {
    error: jest.fn(),
  },
}));

describe('EventListener', () => {
  let mockTarget: EventTarget;
  let eventListener: EventListener<Event>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockTarget = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    } as any;

    eventListener = new EventListener<Event>();
  });

  it('registers event listener on target', () => {
    const handler = jest.fn();

    eventListener.set(mockTarget, DOM_EVENT.CLICK, handler);

    expect(mockTarget.addEventListener).toHaveBeenCalledWith(DOM_EVENT.CLICK, handler, undefined);
  });

  it('registers event listener with options', () => {
    const handler = jest.fn();
    const options = { capture: true, passive: true };

    eventListener.set(mockTarget, DOM_EVENT.SCROLL, handler, options);

    expect(mockTarget.addEventListener).toHaveBeenCalledWith(DOM_EVENT.SCROLL, handler, options);
  });

  it('removes event listener correctly', () => {
    const handler = jest.fn();
    const options = { capture: true };

    eventListener.set(mockTarget, DOM_EVENT.KEY_DOWN, handler, options);
    eventListener.remove();

    expect(mockTarget.removeEventListener).toHaveBeenCalledWith(
      DOM_EVENT.KEY_DOWN,
      handler,
      options,
    );
  });

  it('should handle missing or invalid targets gracefully', () => {
    const { rumLogger } = require('@src/shared/Logger');
    const handler = jest.fn();

    // Test with null target
    expect(() => {
      eventListener.set(null as any, DOM_EVENT.CLICK, handler);
    }).not.toThrow();

    // Test with target missing addEventListener
    const invalidTarget = {} as EventTarget;
    expect(() => {
      eventListener.set(invalidTarget, DOM_EVENT.CLICK, handler);
    }).not.toThrow();

    // Test remove without set
    const freshListener = new EventListener();
    expect(() => {
      freshListener.remove();
    }).not.toThrow();

    // Should not have caused any errors to be logged for null checks
    expect(rumLogger.error).not.toHaveBeenCalled();
  });

  it('should handle addEventListener throwing', () => {
    const { rumLogger } = require('@src/shared/Logger');
    const throwingTarget = {
      addEventListener: jest.fn(() => {
        throw new Error('addEventListener failed');
      }),
    } as any;

    const handler = jest.fn();

    expect(() => {
      eventListener.set(throwingTarget, DOM_EVENT.CLICK, handler);
    }).not.toThrow();

    expect(rumLogger.error).toHaveBeenCalledWith(
      'Failed to add event listener: ',
      expect.any(Error),
    );
  });

  it('should handle removeEventListener throwing', () => {
    const { rumLogger } = require('@src/shared/Logger');
    const throwingTarget = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(() => {
        throw new Error('removeEventListener failed');
      }),
    } as any;

    const handler = jest.fn();

    eventListener.set(throwingTarget, DOM_EVENT.CLICK, handler);

    expect(() => {
      eventListener.remove();
    }).not.toThrow();

    expect(rumLogger.error).toHaveBeenCalledWith(
      'Failed to remove event listener: ',
      expect.any(Error),
    );
  });

  it('should clear internal state after remove', () => {
    const handler = jest.fn();

    eventListener.set(mockTarget, DOM_EVENT.CLICK, handler);
    eventListener.remove();

    // Calling remove again should not attempt to remove again
    jest.clearAllMocks();
    eventListener.remove();

    expect(mockTarget.removeEventListener).not.toHaveBeenCalled();
  });
});
