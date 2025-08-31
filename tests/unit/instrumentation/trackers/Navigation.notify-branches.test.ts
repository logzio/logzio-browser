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
  });

  it('should log when a subscriber throws', () => {
    const tracker = NavigationTracker.getInstance();

    const unsubscribe = tracker.subscribe(NavigationEventType.STARTED, () => {
      throw new Error('handler failure');
    });

    (tracker as any).notify(NavigationEventType.STARTED, {
      oldUrl: 'https://a',
      newUrl: 'https://b',
      timestamp: Date.now(),
    });

    expect(rumLogger.error).toHaveBeenCalled();
    unsubscribe();
  });
});
