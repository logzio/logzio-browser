/**
 * @jest-environment jsdom
 */

import { setupErrorsTest } from '../../__utils__/errorsTestHelpers';

// Mock shared dependencies using centralized helper
jest.mock('@src/shared', () => {
  const { createErrorsSharedMocks } = require('../../__utils__/errorsTestHelpers');
  return createErrorsSharedMocks();
});

describe('ErrorTracker Initialization Errors', () => {
  let testSetup: ReturnType<typeof setupErrorsTest>;

  beforeEach(() => {
    testSetup = setupErrorsTest();
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should log error when EventListener constructor throws', () => {
    // Get the mocked modules
    const sharedModule = require('@src/shared');
    const { EventListener, rumLogger } = sharedModule;

    // Make EventListener constructor throw
    EventListener.mockImplementationOnce(() => {
      throw new Error('EventListener constructor failed');
    });

    const tracker = testSetup.ErrorTracker.getInstance();

    expect(() => tracker.init()).not.toThrow();
    expect(rumLogger.error).toHaveBeenCalledWith(
      'Failed to set up error tracking:',
      expect.any(Error),
    );
  });

  it('should log error when EventListener.set throws', () => {
    // Get the mocked modules
    const sharedModule = require('@src/shared');
    const { EventListener, rumLogger } = sharedModule;

    const mockSet = jest.fn().mockImplementation(() => {
      throw new Error('EventListener.set failed');
    });

    EventListener.mockImplementation(() => ({
      set: mockSet,
      remove: jest.fn(),
    }));

    const tracker = testSetup.ErrorTracker.getInstance();

    expect(() => tracker.init()).not.toThrow();
    expect(rumLogger.error).toHaveBeenCalledWith(
      'Failed to set up error tracking:',
      expect.any(Error),
    );
  });

  it('should continue functioning after initialization errors', () => {
    // Get the mocked modules
    const sharedModule = require('@src/shared');
    const { EventListener, rumLogger } = sharedModule;

    // Make first EventListener fail, second succeed
    EventListener.mockImplementationOnce(() => {
      throw new Error('First EventListener failed');
    }).mockImplementationOnce(() => ({
      set: jest.fn(),
      remove: jest.fn(),
    }));

    const tracker = testSetup.ErrorTracker.getInstance();
    tracker.init();

    // Should still be able to subscribe
    const handler = jest.fn();
    expect(() => tracker.subscribe(handler)).not.toThrow();

    // Should log the error
    expect(rumLogger.error).toHaveBeenCalled();
  });

  it('should enforce no-throw policy during subscribe', () => {
    const tracker = testSetup.ErrorTracker.getInstance();

    // Even without proper initialization, subscribe should not throw
    expect(() => tracker.subscribe(jest.fn())).not.toThrow();
    expect(() => tracker.subscribe(null as any)).not.toThrow();
    expect(() => tracker.subscribe(undefined as any)).not.toThrow();
  });

  it('should enforce no-throw policy during unsubscribe', () => {
    const tracker = testSetup.ErrorTracker.getInstance();

    // Even with malformed unsubscribe functions, should not throw
    const unsubscribe = tracker.subscribe(jest.fn());
    expect(() => unsubscribe()).not.toThrow();

    // Multiple calls should be safe
    expect(() => unsubscribe()).not.toThrow();
  });

  it('should handle multiple initialization errors gracefully', () => {
    // Get the mocked modules
    const sharedModule = require('@src/shared');
    const { EventListener, rumLogger } = sharedModule;

    // Make EventListener constructor throw
    EventListener.mockImplementation(() => {
      throw new Error('Constructor failed');
    });

    const tracker = testSetup.ErrorTracker.getInstance();

    expect(() => {
      tracker.subscribe(jest.fn());
    }).not.toThrow();

    // Should have logged errors
    expect(rumLogger.error).toHaveBeenCalled();
  });
});
