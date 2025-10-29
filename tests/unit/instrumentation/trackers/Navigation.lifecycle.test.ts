/**
 * @jest-environment jsdom
 */

import { setupNavigationTest } from '../../__utils__/navigationTestHelpers';

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

describe('NavigationTracker Lifecycle', () => {
  let testSetup: ReturnType<typeof setupNavigationTest>;

  beforeEach(() => {
    testSetup = setupNavigationTest();
  });

  afterEach(() => {
    testSetup.cleanup();
  });

  it('should initialize successfully', () => {
    const tracker = testSetup.NavigationTracker.getInstance();

    expect(() => tracker.init()).not.toThrow();
  });

  it('should track initialization state correctly', () => {
    const tracker = testSetup.NavigationTracker.getInstance();

    // Multiple inits should be safe
    tracker.init();
    tracker.init();
    tracker.init();

    expect(() => testSetup.NavigationTracker.shutdown()).not.toThrow();
  });

  it('should handle shutdown gracefully', () => {
    const tracker = testSetup.NavigationTracker.getInstance();
    tracker.init();

    expect(() => testSetup.NavigationTracker.shutdown()).not.toThrow();

    // Multiple shutdowns should be safe
    expect(() => testSetup.NavigationTracker.shutdown()).not.toThrow();
  });

  it('should support re-initialization after shutdown', () => {
    const tracker = testSetup.NavigationTracker.getInstance();

    // First lifecycle
    tracker.init();
    testSetup.NavigationTracker.shutdown();

    // Re-init should work
    expect(() => tracker.init()).not.toThrow();
  });

  it('should handle subscription operations safely', () => {
    const tracker = testSetup.NavigationTracker.getInstance();
    const handler = jest.fn();

    // Subscribe before init should work
    expect(() => tracker.subscribe('STARTED', handler)).not.toThrow();

    // Init and operations should work
    tracker.init();
    expect(() => tracker.subscribe('STARTED', jest.fn())).not.toThrow();

    // Shutdown should work
    expect(() => testSetup.NavigationTracker.shutdown()).not.toThrow();
  });

  it('should provide consistent getCurrentUrl functionality', () => {
    const tracker = testSetup.NavigationTracker.getInstance();

    // Should work before init
    expect(typeof tracker.getCurrentUrl()).toBe('string');

    tracker.init();

    // Should work after init
    expect(typeof tracker.getCurrentUrl()).toBe('string');
  });
});
