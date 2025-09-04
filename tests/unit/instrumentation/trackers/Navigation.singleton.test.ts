/**
 * @jest-environment jsdom
 */

import { resetNavigationTracker } from '../../__utils__/navigationTestHelpers';

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

describe('NavigationTracker Singleton', () => {
  beforeEach(() => {
    resetNavigationTracker();
    jest.clearAllMocks();
  });

  afterEach(() => {
    resetNavigationTracker();
  });

  it('should return same instance on consecutive calls', () => {
    const { NavigationTracker } = jest.requireActual('@src/instrumentation/trackers/Navigation');

    const instance1 = NavigationTracker.getInstance();
    const instance2 = NavigationTracker.getInstance();
    const instance3 = NavigationTracker.getInstance();

    expect(instance1).toBe(instance2);
    expect(instance2).toBe(instance3);
    expect(instance1).toBe(instance3);
  });

  it('should create new instance after singleton reset', () => {
    const { NavigationTracker } = jest.requireActual('@src/instrumentation/trackers/Navigation');

    const instance1 = NavigationTracker.getInstance();

    resetNavigationTracker();

    const instance2 = NavigationTracker.getInstance();

    expect(instance1).not.toBe(instance2);
  });

  it('should have consistent API across instances', () => {
    const { NavigationTracker } = jest.requireActual('@src/instrumentation/trackers/Navigation');

    const instance1 = NavigationTracker.getInstance();
    const instance2 = NavigationTracker.getInstance();

    // Should be same instance with consistent API
    expect(instance1).toBe(instance2);
    expect(typeof instance1.init).toBe('function');
    expect(typeof instance1.subscribe).toBe('function');
    expect(typeof NavigationTracker.shutdown).toBe('function');
    expect(typeof instance1.getCurrentUrl).toBe('function');
  });

  it('should maintain singleton state during operations', () => {
    const { NavigationTracker } = jest.requireActual('@src/instrumentation/trackers/Navigation');

    const instance1 = NavigationTracker.getInstance();

    // Perform operations
    expect(() => instance1.init()).not.toThrow();
    expect(() => instance1.subscribe('STARTED', jest.fn())).not.toThrow();

    const instance2 = NavigationTracker.getInstance();

    // Should still be same instance
    expect(instance1).toBe(instance2);
  });
});
