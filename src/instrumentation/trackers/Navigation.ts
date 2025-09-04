import { DOM_EVENT, EventListener, rumLogger } from '../../shared';

export enum NavigationEventType {
  STARTED = 'navigation_started',
  ENDED = 'navigation_ended',
}

export interface NavigationEventData {
  oldUrl: string;
  newUrl: string;
  timestamp: number;
}

export type NavigationEventHandler = (eventData: NavigationEventData) => void;

/**
 * Centralized Tracker that manages navigation events and notifies subscribed components.
 */
export class NavigationTracker {
  private static instance: NavigationTracker | null = null;
  private subscribers: Map<NavigationEventType, Set<NavigationEventHandler>> = new Map();
  private eventListeners: EventListener[] = [];
  private currentUrl: string;
  private isInitialized = false;
  private originalHistory: { [key: string]: ((...args: any[]) => any) | undefined } = {};

  private constructor() {
    this.currentUrl = window.location.href;
  }

  /**
   * Implements the singleton pattern.
   */
  public static getInstance(): NavigationTracker {
    if (!NavigationTracker.instance) {
      NavigationTracker.instance = new NavigationTracker();
    }
    return NavigationTracker.instance;
  }

  /**
   * Initializes the navigation tracker and starts monitoring navigation events
   */
  public init(): void {
    if (this.isInitialized) {
      return;
    }

    this.setupNavigationListeners();
    this.isInitialized = true;
  }

  /**
   * Subscribes to navigation events
   * @param eventType - The type of navigation event to subscribe to
   * @param handler - The callback function to execute when the event occurs
   * @returns Unsubscribe function to remove the subscription
   */
  public subscribe(eventType: NavigationEventType, handler: NavigationEventHandler): () => void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, new Set());
    }

    this.subscribers.get(eventType)!.add(handler);

    return () => {
      const handlers = this.subscribers.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.subscribers.delete(eventType);
        }
      }
    };
  }

  /**
   * Notifies all subscribers of a navigation event
   * @param eventType - The type of navigation event
   * @param eventData - The navigation event data
   */
  private notify(eventType: NavigationEventType, eventData: NavigationEventData): void {
    const handlers = this.subscribers.get(eventType);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(eventData);
        } catch (error) {
          rumLogger.error('Error in navigation event handler:', error);
        }
      });
    }
  }

  /**
   * Sets up navigation event listeners for popstate and history API methods
   */
  private setupNavigationListeners(): void {
    const popStateListener = new EventListener<PopStateEvent>();
    popStateListener.set(window, DOM_EVENT.POP_STATE, this.handleNavigation.bind(this));
    this.eventListeners.push(popStateListener);

    this.patchHistoryMethods();
  }

  /**
   * Patches history API methods to detect programmatic navigation
   */
  private patchHistoryMethods(): void {
    const methods: (keyof History)[] = [
      DOM_EVENT.PUSH_STATE,
      DOM_EVENT.REPLACE_STATE,
      DOM_EVENT.GO,
      DOM_EVENT.BACK,
      DOM_EVENT.FORWARD,
    ];

    methods.forEach((method) => {
      const original = (history as any)[method];

      if (typeof original === 'function' && !this.originalHistory[method as string]) {
        this.originalHistory[method as string] = original;

        (history as any)[method] = (...args: any[]) => {
          const oldUrl = window.location.href;
          const result = original.apply(history, args);
          const newUrl = window.location.href;

          if (newUrl !== oldUrl) {
            const eventData: NavigationEventData = {
              oldUrl: oldUrl,
              newUrl: newUrl,
              timestamp: Date.now(),
            };
            this.notify(NavigationEventType.STARTED, eventData);
            this.notify(NavigationEventType.ENDED, eventData);
            this.currentUrl = newUrl;
          }
          return result;
        };
      }
    });
  }

  /**
   * Handles navigation events by checking if URL has changed and notifying subscribers
   */
  private handleNavigation(): void {
    const newUrl = window.location.href;

    if (newUrl !== this.currentUrl) {
      const eventData: NavigationEventData = {
        oldUrl: this.currentUrl,
        newUrl: newUrl,
        timestamp: Date.now(),
      };

      this.notify(NavigationEventType.STARTED, eventData);
      this.notify(NavigationEventType.ENDED, eventData);

      this.currentUrl = newUrl;
    }
  }

  /**
   * Gets the current URL
   */
  public getCurrentUrl(): string {
    return this.currentUrl;
  }

  /**
   * Shuts down the navigation tracker and cleans up event listeners
   */
  public static shutdown(): void {
    const nt = NavigationTracker.getInstance();

    if (nt) {
      nt.eventListeners.forEach((listener) => {
        listener.remove();
      });
      nt.eventListeners = [];
      nt.subscribers.clear();
      nt.isInitialized = false;
      nt.unpatchHistoryMethods();
      nt.originalHistory = {};
    }
    NavigationTracker.instance = null;
  }

  private unpatchHistoryMethods(): void {
    for (const method in this.originalHistory) {
      if (Object.prototype.hasOwnProperty.call(this.originalHistory, method)) {
        (history as any)[method] = this.originalHistory[method];
      }
    }
  }
}
