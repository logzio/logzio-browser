import { createUtilsMock } from '../__utils__/utilsMocks';

// Mock dependencies before imports using centralized helper
jest.mock('@src/utils', () => createUtilsMock('new-session-123'));

jest.mock('@src/shared', () => {
  const actual = jest.requireActual('@src/shared');
  return {
    ...actual, // Keep real DOM_EVENT and ACTIVITY_EVENTS
    EventListener: jest.fn().mockImplementation(() => ({
      set: jest.fn(),
      remove: jest.fn(),
    })),
  };
});

jest.mock('@src/openTelemetry/setup', () => ({
  OpenTelemetryProvider: {
    getInstance: jest.fn(() => ({
      forceFlush: jest.fn(),
      rerollSampling: jest.fn(),
    })),
  },
}));

const mockNavigationTrackerInstance = {
  subscribe: jest.fn(() => jest.fn()), // Returns unsubscribe function
};

jest.mock('@src/instrumentation/trackers', () => ({
  NavigationEventType: {
    STARTED: 'navigation:started',
  },
  NavigationTracker: {
    getInstance: jest.fn(() => mockNavigationTrackerInstance),
  },
}));

jest.mock('@src/context/RUMView', () => ({
  RUMView: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    end: jest.fn(),
    getUrl: jest.fn(() => 'https://example.com'),
  })),
}));

import { RUMView } from '@src/context/RUMView';
import { RUMSessionManager } from '@src/context/RUMSessionManager';
import { LocalStorageStore, generateId } from '@src/utils';
import { EventListener, ACTIVITY_EVENTS } from '@src/shared';

describe('RUMSessionManager navigation and timeouts', () => {
  let eventListenerInstances: any[];

  beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: true });
    jest.setSystemTime(20_000);
    jest.clearAllMocks();

    // Track EventListener instances
    eventListenerInstances = [];
    (EventListener as jest.Mock).mockImplementation(() => {
      const instance = { set: jest.fn(), remove: jest.fn() };
      eventListenerInstances.push(instance);
      return instance;
    });

    (LocalStorageStore.get as jest.Mock).mockReturnValue('current-session');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const createConfig = (overrides?: any) => ({
    tokens: { metrics: 'test-metrics-token' },
    enable: { navigation: true },
    session: { maxDurationMs: 2000, timeoutMs: 1500 },
    ...overrides,
  });

  it('should trigger new view only when URL changed in navigation started', () => {
    const config = createConfig();
    const manager = new RUMSessionManager(config as any);

    manager.start();
    const initialViewInstance = (RUMView as any).mock.results[0].value;

    // Get the navigation handler from the mocked subscribe calls
    expect(mockNavigationTrackerInstance.subscribe).toHaveBeenCalledWith(
      'navigation:started',
      expect.any(Function),
    );
    const subscribeMock = mockNavigationTrackerInstance.subscribe as jest.Mock;
    const navigationHandler = subscribeMock.mock.calls[0][1] as Function;

    // Case A: Same URL - no change
    initialViewInstance.getUrl.mockReturnValue(window.location.href);

    jest.clearAllMocks();
    navigationHandler();

    expect(initialViewInstance.end).not.toHaveBeenCalled();
    expect(RUMView).not.toHaveBeenCalled();

    // Case B: Different URL - should trigger new view
    initialViewInstance.getUrl.mockReturnValue('https://different.com');

    navigationHandler();

    expect(initialViewInstance.end).toHaveBeenCalled();
    expect(RUMView).toHaveBeenCalledWith('current-session', config);
    const newViewInstance = (RUMView as any).mock.results[0].value;
    expect(newViewInstance.start).toHaveBeenCalled();
  });

  it('should trigger renewal in max duration timer', () => {
    const config = createConfig();
    const manager = new RUMSessionManager(config as any);

    manager.start();
    const initialViewInstance = (RUMView as any).mock.results[0].value;

    jest.clearAllMocks();

    // Advance time past max duration
    jest.advanceTimersByTime(2000);

    // Should trigger renewal
    expect(initialViewInstance.end).toHaveBeenCalled();
    expect(generateId).toHaveBeenCalled();
    expect(LocalStorageStore.set).toHaveBeenCalledWith('logzio-rum-session-id', 'new-session-123');
    expect(RUMView).toHaveBeenCalledWith('new-session-123', config);
    const newViewInstance = (RUMView as any).mock.results[0].value;
    expect(newViewInstance.start).toHaveBeenCalled();
  });

  it('should timeout session in inactivity interval', () => {
    const config = createConfig();
    const manager = new RUMSessionManager(config as any);

    // Set old activity time (older than timeout)
    const oldActivityTime = (20_000 - 1500 - 100).toString(); // timeout + buffer
    (LocalStorageStore.get as jest.Mock).mockImplementation((key) => {
      if (key === 'logzio-rum-session-id') return 'current-session';
      if (key === 'logzio-rum-last-activity') return oldActivityTime;
      return null;
    });

    manager.start();
    const viewInstance = (RUMView as any).mock.results[0].value;

    jest.clearAllMocks();

    // Advance time by inactivity check interval
    jest.advanceTimersByTime(10000); // LAST_ACTIVITY_CHECK_INTERVAL

    expect(viewInstance.end).toHaveBeenCalled();
    expect(LocalStorageStore.remove).toHaveBeenCalledWith('logzio-rum-session-id');
  });

  it('should update last activity in activity listeners', () => {
    const config = createConfig();
    const manager = new RUMSessionManager(config as any);

    manager.start();

    // Move clock past throttle window (2s) without firing timers
    jest.setSystemTime(Date.now() + 2001);

    // Test first two activity events
    const testEvents = ACTIVITY_EVENTS.slice(0, 2);

    testEvents.forEach((eventName, index) => {
      const activityListener = eventListenerInstances.find((listener) =>
        listener.set.mock.calls.some((call: any) => call[1] === eventName),
      );

      if (activityListener) {
        const activityHandler = activityListener.set.mock.calls.find(
          (call: any) => call[1] === eventName,
        )[2];

        // Move clock past throttle between each call without firing timers
        if (index > 0) jest.setSystemTime(Date.now() + 2001);
        jest.clearAllMocks();
        activityHandler();

        expect(LocalStorageStore.set).toHaveBeenCalledWith(
          'logzio-rum-last-activity',
          expect.any(String),
        );
      }
    });
  });

  it('should remove listeners in shutdown()', () => {
    const config = createConfig();
    const manager = new RUMSessionManager(config as any);

    manager.start();
    const viewInstance = (RUMView as any).mock.results[0].value;

    manager.shutdown();

    // Should end the session
    expect(viewInstance.end).toHaveBeenCalled();

    // Should remove all event listeners
    eventListenerInstances.forEach((listener) => {
      expect(listener.remove).toHaveBeenCalled();
    });
  });
});
