jest.mock('@src/shared', () => ({
  DOM_EVENT: {
    POP_STATE: 'popstate',
    PUSH_STATE: 'pushState',
    REPLACE_STATE: 'replaceState',
    GO: 'go',
    BACK: 'back',
    FORWARD: 'forward',
  },
  EventListener: class {
    set() {}
    remove() {}
  },
  rumLogger: {
    error: jest.fn(),
  },
}));

import { NavigationTracker, NavigationEventType } from '@src/instrumentation/trackers/Navigation';
import { rumLogger } from '@src/shared';

describe('NavigationTracker notify error branch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    NavigationTracker.shutdown(); // ensure clean singleton and unpatched history
  });

  afterEach(() => {
    NavigationTracker.shutdown(); // restore history methods for other tests
  });

  it('should log when a subscriber throws', () => {
    // Ensure a different starting URL so a navigation is detected
    history.replaceState({}, '', '/a');

    const tracker = NavigationTracker.getInstance();
    tracker.init();

    const unsubscribe = tracker.subscribe(NavigationEventType.STARTED, () => {
      throw new Error('handler failure');
    });

    history.pushState({}, '', '/b'); // triggers STARTED/ENDED via patched history

    expect(rumLogger.error).toHaveBeenCalled();
    unsubscribe();
  });
});
