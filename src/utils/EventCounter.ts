import { ErrorTracker, ErrorEventData } from '../instrumentation/trackers';
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
  private activityEventsListeners: EventListener[] = [];

  constructor(private activityEvents?: DOM_EVENT[]) {
    if (activityEvents) {
      this.counters.activities = 0;
      this.activityEvents = activityEvents.filter(
        (e) => e !== DOM_EVENT.ERROR && e !== DOM_EVENT.UNHANDLED_REJECTION,
      );
    }
    this.start();
  }

  /**
   * Starts tracking events.
   */
  private start(): void {
    try {
      const errorTracker = ErrorTracker.getInstance();
      this.errorUnsubscribe = errorTracker.subscribe(this.onError.bind(this));
    } catch (error) {
      rumLogger.error('Event counter failed to start error tracking: ', error);
    }

    this.setupActivityTracking();
  }

  /**
   * Stops tracking events and returns the counters since construction.
   * @returns Event counters for the time period since creation
   */
  public stop(): EventsCounter {
    this.unsubscribeFromErrorTracker();
    this.unsubscribeFromActivityTracking();

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
   * Increments the activity counter.
   */
  private onActivity(): void {
    try {
      this.counters.activities!++;
    } catch (error) {
      rumLogger.error('Event counter failed to increment activity counter: ', error);
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
}
