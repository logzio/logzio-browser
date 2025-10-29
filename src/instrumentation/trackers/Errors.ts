import { DOM_EVENT, EventListener, rumLogger } from '../../shared';

export interface ErrorEventData {
  timestamp: number;
  kind: DOM_EVENT.ERROR | DOM_EVENT.UNHANDLED_REJECTION;
  message: string;
  filename?: string;
  line?: number;
  column?: number;
  stack?: string;
}

export type ErrorHandler = (event: ErrorEventData) => void;

/**
 * Singleton tracker for error events that allows multiple components to subscribe
 * without creating duplicate DOM listeners.
 */
export class ErrorTracker {
  private static instance: ErrorTracker | null = null;
  private subscribers: Set<ErrorHandler> = new Set();
  private eventListeners: EventListener[] = [];
  private isInitialized = false;

  private constructor() {}

  /**
   * Gets the singleton instance.
   */
  public static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker();
    }
    return ErrorTracker.instance;
  }

  /**
   * Initializes the error tracker and starts monitoring error events.
   * Called automatically when the first subscriber is added.
   */
  private init(): void {
    if (this.isInitialized) {
      return;
    }

    this.setupErrorListeners();
    this.isInitialized = true;
  }

  /**
   * Subscribes to error events.
   * @param handler - The callback function to execute when an error occurs
   * @returns Unsubscribe function to remove the subscription
   */
  public subscribe(handler: ErrorHandler): () => void {
    if (this.subscribers.size === 0) {
      this.init();
    }

    this.subscribers.add(handler);

    return () => {
      this.subscribers.delete(handler);
      if (this.subscribers.size === 0) {
        this.shutdown();
      }
    };
  }

  /**
   * Notifies all subscribers of an error event.
   * @param event - The error event data
   */
  private notify(event: ErrorEventData): void {
    this.subscribers.forEach((handler) => {
      try {
        handler(event);
      } catch (error) {
        rumLogger.error('Error in error event handler:', error);
      }
    });
  }

  /**
   * Sets up error event listeners.
   */
  private setupErrorListeners(): void {
    try {
      // Track JavaScript errors
      const errorListener = new EventListener<ErrorEvent>();
      errorListener.set(window, DOM_EVENT.ERROR, (event) => {
        this.notify({
          timestamp: Date.now(),
          kind: DOM_EVENT.ERROR,
          message: event.message || 'Unknown error',
          filename: event.filename,
          line: event.lineno,
          column: event.colno,
          stack: event.error?.stack,
        });
      });
      this.eventListeners.push(errorListener);

      // Track unhandled promise rejections
      const rejectionListener = new EventListener<PromiseRejectionEvent>();
      rejectionListener.set(window, DOM_EVENT.UNHANDLED_REJECTION, (event) => {
        this.notify({
          timestamp: Date.now(),
          kind: DOM_EVENT.UNHANDLED_REJECTION,
          message: String(event.reason),
        });
      });
      this.eventListeners.push(rejectionListener);
    } catch (error) {
      rumLogger.error('Failed to set up error tracking:', error);
    }
  }

  /**
   * Shuts down the error tracker and cleans up event listeners.
   */
  private shutdown(): void {
    this.eventListeners.forEach((listener) => {
      listener.remove();
    });
    this.eventListeners = [];
    this.isInitialized = false;
  }
}
