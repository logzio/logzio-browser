import {
  ErrorTracker,
  ErrorEventData,
  MutationObserverTracker,
  MutationEventData,
} from '../instrumentation/trackers';
import { DOM_EVENT, EventListener, rumLogger } from '../shared';

export interface EventsCounter {
  errors: number;
  activities?: number;
}

/**
 * This class tracks various events from creation until stop().
 * Used to correlate errors and activity events with specific user interactions.
 */
export class EventMonitor {
  private counters: EventsCounter = {
    errors: 0,
  };
  private errorUnsubscribe: (() => void) | null = null;
  private mutationUnsubscribe: (() => void) | null = null;
  private activityEventsListeners: EventListener[] = [];
  private startTime: number;
  private activityCallback?: () => void;

  constructor(private activityEvents?: DOM_EVENT[]) {
    this.startTime = Date.now();

    if (activityEvents) {
      this.counters.activities = 0;

      this.activityEvents = activityEvents.filter(
        (e) =>
          e !== DOM_EVENT.ERROR &&
          e !== DOM_EVENT.UNHANDLED_REJECTION &&
          e !== DOM_EVENT.DOM_MUTATION,
      );
    }
    this.start();
  }

  /**
   * Starts tracking events.
   */
  private start(): void {
    // Set up mutation tracking FIRST to catch immediate DOM changes
    this.setupMutationTracking();
    this.setupErrorTracking();
    this.setupActivityTracking();
  }

  /**
   * Sets a callback to be called whenever activity is detected.
   * Used for idle window logic in dead click detection.
   * @param callback Function to call when activity is detected
   */
  public setActivityCallback(callback: () => void): void {
    this.activityCallback = callback;
  }

  /**
   * Stops tracking events and returns the counters since construction.
   * @returns Event counters for the time period since creation
   */
  public stop(): EventsCounter {
    this.unsubscribeFromErrorTracker();
    this.unsubscribeFromActivityTracking();
    this.unsubscribeFromMutationTracking();
    this.activityCallback = undefined;

    // Return a copy to prevent external mutation
    return { ...this.counters };
  }

  /**
   * Increments the error counter.
   * @param _event the error event data.
   */
  private onError(_event: ErrorEventData): void {
    this.counters.errors++;
  }

  /**
   * Sets up error tracking.
   */
  private setupErrorTracking(): void {
    try {
      const errorTracker = ErrorTracker.getInstance();
      this.errorUnsubscribe = errorTracker.subscribe(this.onError.bind(this));
    } catch (error) {
      rumLogger.error('Event counter failed to start error tracking: ', error);
    }
  }

  /**
   * Sets up activity tracking.
   */
  private setupActivityTracking(): void {
    this.activityEvents?.forEach((event) => {
      try {
        const listener = new EventListener<Event>();
        listener.set(window, event, this.onActivity.bind(this));
        this.activityEventsListeners.push(listener);
      } catch (error) {
        rumLogger.error('Event counter failed to setup activity tracking: ', error);
      }
    });
  }

  /**
   * Sets up mutation tracking if activities should be tracked.
   * DOM mutations are treated as activities for dead click detection.
   */
  private setupMutationTracking(): void {
    // Only setup mutation tracking if we're tracking activities
    if (this.counters.activities !== undefined) {
      try {
        const mutationTracker = MutationObserverTracker.getInstance();
        this.mutationUnsubscribe = mutationTracker.subscribe(this.onMutation.bind(this));
      } catch (error) {
        rumLogger.error('Event counter failed to setup mutation tracking: ', error);
      }
    }
  }

  /**
   * Increments the activity counter.
   */
  private onActivity(): void {
    try {
      this.counters.activities!++;
      // Notify about activity for idle window logic
      if (this.activityCallback) {
        this.activityCallback();
      }
    } catch (error) {
      rumLogger.error('Event counter failed to increment activity counter: ', error);
    }
  }

  /**
   * Increments the activity counter for mutations that occurred after start time.
   * DOM mutations are considered activities for dead click detection.
   * @param event the mutation event data.
   */
  private onMutation(event: MutationEventData): void {
    try {
      // Only count mutations that happened after this monitor started
      if (event.timestamp >= this.startTime && this.counters.activities !== undefined) {
        this.counters.activities++;
        // Notify about activity for idle window logic
        if (this.activityCallback) {
          this.activityCallback();
        }
      }
    } catch (error) {
      rumLogger.error('Event counter failed to increment activity counter for mutation: ', error);
    }
  }

  /**
   * Unsubscribes from the error tracker.
   */
  private unsubscribeFromErrorTracker(): void {
    if (this.errorUnsubscribe) {
      this.errorUnsubscribe();
      this.errorUnsubscribe = null;
    }
  }

  private unsubscribeFromActivityTracking(): void {
    this.activityEventsListeners.forEach((listener) => {
      listener.remove();
    });
    this.activityEventsListeners = [];
  }

  /**
   * Unsubscribes from the mutation tracker.
   */
  private unsubscribeFromMutationTracking(): void {
    if (this.mutationUnsubscribe) {
      this.mutationUnsubscribe();
      this.mutationUnsubscribe = null;
    }
  }
}
