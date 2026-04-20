import { createUtilsMock } from '../__utils__/utilsMocks';
import { createSharedMock } from '../__utils__/loggerMocks';

// Mock dependencies before imports
jest.mock('@src/utils', () => createUtilsMock('session-abc'));
jest.mock('@src/shared', () => createSharedMock());

const mockOtelInstance = {
  forceFlush: jest.fn(),
  rerollSampling: jest.fn(),
};

jest.mock('@src/openTelemetry/setup', () => ({
  OpenTelemetryProvider: {
    getInstance: jest.fn(() => mockOtelInstance),
  },
}));

jest.mock('@src/context/RUMView', () => ({
  RUMView: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    end: jest.fn(),
    getUrl: jest.fn(() => 'https://example.com'),
  })),
}));

jest.mock('@src/instrumentation/trackers', () => ({
  NavigationEventType: {
    STARTED: 'navigation:started',
  },
  NavigationTracker: {
    getInstance: jest.fn(() => ({
      subscribe: jest.fn(() => jest.fn()), // Returns unsubscribe function
    })),
  },
}));

import { RUMView } from '@src/context/RUMView';
import { RUMSessionManager } from '@src/context/RUMSessionManager';
import { LocalStorageStore } from '@src/utils';
import { EventListener, DOM_EVENT } from '@src/shared';
import { createConfig } from '../__utils__/configFactory';
import { findListenerHandler } from '../__utils__/eventListenerHelpers';

describe('RUMSessionManager lifecycle and events', () => {
  let eventListenerInstances: any[];

  beforeEach(() => {
    jest.useFakeTimers({ advanceTimers: true });
    jest.setSystemTime(10_000);
    jest.clearAllMocks();

    // Track EventListener instances
    eventListenerInstances = [];
    (EventListener as jest.Mock).mockImplementation(() => {
      const instance = { set: jest.fn(), remove: jest.fn() };
      eventListenerInstances.push(instance);
      return instance;
    });

    // NavigationTracker is mocked at the module level

    // Default storage behavior
    (LocalStorageStore.get as jest.Mock).mockReturnValue('existing-session');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should wire everything and update last activity in start()', () => {
    const config = createConfig({ enable: { navigation: true } });
    const manager = new RUMSessionManager(config as any);

    manager.start();

    // Should get existing session or generate new one
    expect(LocalStorageStore.get).toHaveBeenCalledWith('logzio-rum-session-id');

    // Should update activity time
    expect(LocalStorageStore.set).toHaveBeenCalledWith('logzio-rum-last-activity', '10000');

    // Should create and start RUMView
    expect(RUMView).toHaveBeenCalledWith('existing-session', config);
    const viewInstance = (RUMView as any).mock.results[0].value;
    expect(viewInstance.start).toHaveBeenCalled();

    // Navigation subscription setup is tested in other test files

    // Should setup event listeners (visibility, unload, storage, activity events)
    expect(EventListener).toHaveBeenCalledTimes(9); // 1 visibility + 1 unload + 1 storage + 6 activity events
    eventListenerInstances.forEach((listener) => {
      expect(listener.set).toHaveBeenCalled();
    });
  });

  it('should gracefully end and clear timers in end()', () => {
    const config = createConfig({ enable: { navigation: true } });
    const manager = new RUMSessionManager(config as any);

    manager.start();
    const viewInstance = (RUMView as any).mock.results[0].value;

    manager.end();

    expect(viewInstance.end).toHaveBeenCalled();
    expect(mockOtelInstance.forceFlush).toHaveBeenCalled();
  });

  it('should end existing view and re-init with new session id in renew()', () => {
    const config = createConfig({ enable: { navigation: true } });
    const manager = new RUMSessionManager(config as any);

    manager.start();
    const firstViewInstance = (RUMView as any).mock.results[0].value;
    jest.clearAllMocks();

    manager.renew();

    // Should end existing view
    expect(firstViewInstance.end).toHaveBeenCalled();

    // Should get session again and create new view
    expect(LocalStorageStore.get).toHaveBeenCalledWith('logzio-rum-session-id');
    expect(RUMView).toHaveBeenCalledWith('existing-session', config);
    const newViewInstance = (RUMView as any).mock.results[0].value;
    expect(newViewInstance.start).toHaveBeenCalled();
  });

  it('should update activity and renew if session id missing in resume()', () => {
    const config = createConfig({ enable: { navigation: true } });
    const manager = new RUMSessionManager(config as any);

    manager.start();

    // Case A: Session exists
    jest.clearAllMocks();
    (LocalStorageStore.get as jest.Mock).mockReturnValue('existing-session');

    manager.resume();

    expect(LocalStorageStore.set).toHaveBeenCalledWith('logzio-rum-last-activity', '10000');
    expect(RUMView).not.toHaveBeenCalled(); // No renew

    // Case B: Session missing
    jest.clearAllMocks();
    (LocalStorageStore.get as jest.Mock).mockReturnValue(null);

    manager.resume();

    expect(LocalStorageStore.set).toHaveBeenCalledWith('logzio-rum-last-activity', '10000');
    expect(RUMView).toHaveBeenCalled(); // Renew triggered
  });

  it('should handle hidden/visible states in visibility change listener', () => {
    const config = createConfig({ enable: { navigation: true } });
    const manager = new RUMSessionManager(config as any);

    manager.start();

    // Find visibility listener
    const visibilityHandler = findListenerHandler(
      eventListenerInstances,
      DOM_EVENT.VISIBILITY_CHANGE,
    );

    // Simulate hidden
    Object.defineProperty(document, 'hidden', { value: true, writable: true });
    visibilityHandler();
    expect(mockOtelInstance.forceFlush).toHaveBeenCalled();

    // Simulate visible
    jest.clearAllMocks();
    Object.defineProperty(document, 'hidden', { value: false, writable: true });
    visibilityHandler();
    expect(LocalStorageStore.set).toHaveBeenCalledWith('logzio-rum-last-activity', '10000');
  });

  it('should end session without clearing session id in beforeunload listener', () => {
    const config = createConfig({ enable: { navigation: true } });
    const manager = new RUMSessionManager(config as any);

    manager.start();
    const viewInstance = (RUMView as any).mock.results[0].value;

    // Find beforeunload listener
    const unloadHandler = findListenerHandler(eventListenerInstances, DOM_EVENT.BEFORE_UNLOAD);

    jest.clearAllMocks();
    unloadHandler();

    expect(viewInstance.end).toHaveBeenCalled();
    expect(LocalStorageStore.remove).not.toHaveBeenCalledWith('logzio-rum-session-id');
  });

  it('should handle session changes in storage change listener', () => {
    const config = createConfig({ enable: { navigation: true } });
    const manager = new RUMSessionManager(config as any);

    manager.start();
    const viewInstance = (RUMView as any).mock.results[0].value;

    // Find storage listener
    const storageHandler = findListenerHandler(eventListenerInstances, DOM_EVENT.STORAGE);

    // Case A: Session removed (newValue === null)
    jest.clearAllMocks();
    storageHandler({ key: 'logzio-rum-session-id', newValue: null });
    expect(viewInstance.end).toHaveBeenCalled();

    // Case B: Session changed to different value
    jest.clearAllMocks();
    storageHandler({ key: 'logzio-rum-session-id', newValue: 'different-session' });
    expect(viewInstance.end).toHaveBeenCalled();
    expect(RUMView).toHaveBeenCalled(); // Renew triggered
  });

  it('should clear session id and last activity on shutdown()', () => {
    const config = createConfig({ enable: { navigation: true } });
    const manager = new RUMSessionManager(config as any);

    manager.start();

    // Spy on clearInterval to verify cleanup
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    jest.clearAllMocks();

    manager.shutdown();

    expect(LocalStorageStore.remove).toHaveBeenCalledWith('logzio-rum-session-id');
    expect(LocalStorageStore.remove).toHaveBeenCalledWith('logzio-rum-last-activity');
    expect(clearIntervalSpy).toHaveBeenCalled(); // Verify inactivity interval is cleared

    clearIntervalSpy.mockRestore();
  });

  it('should not clear session id on end()', () => {
    const config = createConfig({ enable: { navigation: true } });
    const manager = new RUMSessionManager(config as any);

    manager.start();
    jest.clearAllMocks();

    manager.end();

    expect(LocalStorageStore.remove).not.toHaveBeenCalledWith('logzio-rum-session-id');
    expect(LocalStorageStore.remove).not.toHaveBeenCalledWith('logzio-rum-last-activity');
  });
});
