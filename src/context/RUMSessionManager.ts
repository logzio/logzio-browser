import { Logger, logs } from '@opentelemetry/api-logs';
import { AttributeNames as otelAttributeNames } from '@opentelemetry/instrumentation-user-interaction';
import type { RUMConfig } from '../config';
import { generateId, LocalStorageStore } from '../utils';
import {
  EventListener,
  DOM_EVENT,
  ACTIVITY_EVENTS,
  rumLogger,
  LOGZIO_RUM_PROVIDER_NAME,
} from '../shared';
import { OpenTelemetryProvider } from '../openTelemetry/setup';
import { NavigationEventType, NavigationTracker } from '../instrumentation/trackers';
import { ATTR_SESSION_ID } from '../instrumentation';
import { RUMView } from './RUMView';
import type { ActiveViewInfo } from './types';

/**
 * This class represents the session manager for the RUM.
 * It starts and ends views, and manages the session.
 */
export class RUMSessionManager {
  private static readonly LOGZIO_SESSION_ID: string = 'logzio-rum-session-id';
  private static readonly LOGZIO_LAST_ACTIVITY: string = 'logzio-rum-last-activity';
  private static readonly LOGZIO_ACTIVE_TABS: string = 'logzio-rum-active-tabs';
  private static readonly LAST_ACTIVITY_CHECK_INTERVAL: number = 10000; // 10 seconds
  private static readonly SESSION_END_EVENT_NAME = 'session_end';

  private sessionId: string | null = null;
  private startTime: number | null = null;
  private maxDurationTimer: ReturnType<typeof setTimeout> | null = null;
  private view: RUMView | null = null;
  private eventListeners: EventListener[] = [];
  private inactivityInterval: ReturnType<typeof setInterval> | null = null;
  private logsProvider: Logger = logs.getLogger(LOGZIO_RUM_PROVIDER_NAME);

  constructor(private readonly config: RUMConfig) {}

  /**
   * Starts a session.
   */
  public start(): void {
    this.init();
    rumLogger.debug(`Starting session ${this.getSessionId()}.`);
    this.incrementActiveTabs();
    this.setupEventsListeners();
    this.startView();
    this.updateActivityTime();
    this.scheduleInactivityTimeoutCheck();
  }

  /**
   * Renews a session with a new session id.
   */
  private renewWithNewSessionId(): void {
    this.view?.end();
    this.generateSessionEndEvent();
    this.sessionId = this.generateNewSessionId();
    rumLogger.debug(`Starting a new session ${this.getSessionId()}.`);
    this.startTime = Date.now();
    this.resetDurationTimer();
    this.startView();
  }

  /**
   * Renews the session when the session changed in a different tab or was previously timed out.
   */
  public renew(): void {
    this.view?.end();
    this.init();
    rumLogger.debug(`Renewing session ${this.getSessionId()}.`);
    this.startView();
  }

  /**
   * Initializes the session.
   * If an existing session id is not found, a new one is generated and stored.
   */
  private init(): void {
    this.sessionId =
      LocalStorageStore.get(RUMSessionManager.LOGZIO_SESSION_ID) || this.generateNewSessionId();
    this.startTime = Date.now();
    this.resetDurationTimer();
  }

  /**
   * Generates a new session id and stores it to notify other tabs about the new session.
   * @returns The new session id.
   */
  private generateNewSessionId(): string {
    const newSessionId = generateId();
    LocalStorageStore.set(RUMSessionManager.LOGZIO_SESSION_ID, newSessionId);
    return newSessionId;
  }

  /**
   * Starts a view.
   */
  private startView(): void {
    this.view = new RUMView(this.sessionId!, this.config);
    this.view.start();
  }

  /**
   * Ends the session gracefully.
   */
  public end(): void {
    rumLogger.debug(`Ending session ${this.getSessionId()}.`);
    this.view?.end();
    this.forceFlush();
    this.clearMaxDurationTimer();
  }

  /**
   * Handles page unload event using tab counter to detect if this is the last tab.
   * Uses localStorage-based tab counting for reliable detection.
   */
  private handlePageUnload(): void {
    this.end();
    this.decrementActiveTabs();
    const remainingTabs = this.getActiveTabsCount();

    if (remainingTabs === 0) {
      this.generateSessionEndEvent();
    }
  }

  /**
   * Generates a session end event to indicate the session has ended.
   * This event is always called by the tab which started the session, since it started first.
   * Other tabs will not generate this event, since they will never timeout or reach max duration prior to the first tab.
   */
  private generateSessionEndEvent(): void {
    if (this.config.enable?.viewEvents) {
      this.logsProvider.emit({
        severityText: 'INFO',
        attributes: {
          [ATTR_SESSION_ID]: this.sessionId,
          [otelAttributeNames.EVENT_TYPE]: RUMSessionManager.SESSION_END_EVENT_NAME,
          duration: this.getDuration(),
        },
      });
    }
  }

  /**
   * Resumes the session if was inactive for a while.
   * If the session was timed out, renews it.
   */
  public resume(): void {
    this.updateActivityTime();
    if (!LocalStorageStore.get(RUMSessionManager.LOGZIO_SESSION_ID)) this.renew();
  }

  /**
   * Resets the max session duration timer.
   */
  private resetDurationTimer(): void {
    this.clearMaxDurationTimer();
    this.maxDurationTimer = setTimeout(
      () => this.renewWithNewSessionId(),
      this.config.session!.maxDurationMs,
    );
  }

  /**
   * Clears the max duration timer.
   */
  private clearMaxDurationTimer(): void {
    if (this.maxDurationTimer) clearTimeout(this.maxDurationTimer);
    this.maxDurationTimer = null;
  }

  /**
   * Clears the session id.
   */
  private clearSessionId(): void {
    LocalStorageStore.remove(RUMSessionManager.LOGZIO_SESSION_ID);
  }

  /**
   * Clears the last activity time.
   */
  private clearLastActivityTime(): void {
    LocalStorageStore.remove(RUMSessionManager.LOGZIO_LAST_ACTIVITY);
  }

  /**
   * Increments the active tabs counter.
   */
  private incrementActiveTabs(): void {
    const currentCount = this.getActiveTabsCount();
    LocalStorageStore.set(RUMSessionManager.LOGZIO_ACTIVE_TABS, String(currentCount + 1));
  }

  /**
   * Decrements the active tabs counter.
   */
  private decrementActiveTabs(): void {
    const currentCount = this.getActiveTabsCount();
    if (currentCount > 0) {
      LocalStorageStore.set(RUMSessionManager.LOGZIO_ACTIVE_TABS, String(currentCount - 1));
    }
  }

  /**
   * Gets the current active tabs count.
   */
  private getActiveTabsCount(): number {
    const count = LocalStorageStore.get(RUMSessionManager.LOGZIO_ACTIVE_TABS);
    return count ? parseInt(count, 10) : 0;
  }

  /**
   * Clears the active tabs counter.
   */
  private clearActiveTabsCount(): void {
    LocalStorageStore.remove(RUMSessionManager.LOGZIO_ACTIVE_TABS);
  }

  /**
   * Times out the session.
   */
  private timeoutSession(): void {
    this.generateSessionEndEvent();
    this.end();
    this.clearSessionId();
  }

  /**
   * Sets up the event listeners.
   */
  private setupEventsListeners(): void {
    this.setupVisibilityListener();
    this.setupUnloadListener();
    this.setupSessionIdChangeListener();
    this.setupNavigationListener();
    this.setupActivityListeners();
  }

  /**
   * Sets up the visibility listener.
   * To follow tab visibility and flush the data when the tab is hidden.
   */
  private setupVisibilityListener(): void {
    const eventListener = new EventListener();
    eventListener.set(document, DOM_EVENT.VISIBILITY_CHANGE, () => {
      if (document.hidden) this.forceFlush();
      else this.resume();
    });
    this.eventListeners.push(eventListener);
  }

  /**
   * Sets up the unload listener.
   * To gracefully end the session when the page is unloaded.
   */
  private setupUnloadListener(): void {
    const eventListener = new EventListener();
    eventListener.set(
      window,
      DOM_EVENT.BEFORE_UNLOAD,
      () => {
        this.handlePageUnload();
      },
      { once: true },
    );
    this.eventListeners.push(eventListener);
  }

  /**
   * Sets up the session id change listener.
   * To correlate the active session with other tabs.
   */
  private setupSessionIdChangeListener(): void {
    const eventListener = new EventListener<StorageEvent>();
    eventListener.set(window, DOM_EVENT.STORAGE, (e) => {
      if (e.key === RUMSessionManager.LOGZIO_SESSION_ID) {
        if (e.newValue === null) this.end();
        else if (e.newValue !== this.sessionId) this.renew();
      }
    });
    this.eventListeners.push(eventListener);
  }

  /**
   * Sets up the navigation listener.
   * To start a new view when a navigation event occurs.
   */
  private setupNavigationListener(): void {
    const navigationTracker = NavigationTracker.getInstance();
    if (this.config.enable!.navigation) {
      const boundNavigationListener = this.onNavigation.bind(this);
      navigationTracker.subscribe(NavigationEventType.STARTED, boundNavigationListener);
    }
  }

  /**
   * Sets up the activity listeners.
   * To update the last user activity time.
   */
  private setupActivityListeners(): void {
    ACTIVITY_EVENTS.forEach((event) => {
      const eventListener = new EventListener();
      eventListener.set(window, event, () => {
        this.updateActivityTime();
      });
      this.eventListeners.push(eventListener);
    });
  }

  /**
   * Starts a new view when a navigation event occurs.
   */
  private onNavigation(): void {
    if (window.location.href !== this.view?.getUrl()) {
      this.view?.end();
      this.startView();
    }
  }

  /**
   * Schedules the inactivity timeout check.
   */
  public scheduleInactivityTimeoutCheck(): void {
    this.inactivityInterval = setInterval(() => {
      const lastActivity = LocalStorageStore.get(RUMSessionManager.LOGZIO_LAST_ACTIVITY);
      if (
        lastActivity &&
        Date.now() - parseInt(lastActivity, 10) > this.config.session!.timeoutMs
      ) {
        this.timeoutSession();
      }
    }, RUMSessionManager.LAST_ACTIVITY_CHECK_INTERVAL);
  }

  /**
   * Clears the inactivity interval.
   */
  private clearInactivityTimeoutInterval(): void {
    if (this.inactivityInterval) clearInterval(this.inactivityInterval);
    this.inactivityInterval = null;
  }

  /**
   * Updates the last activity time.
   */
  private updateActivityTime(): void {
    LocalStorageStore.set(RUMSessionManager.LOGZIO_LAST_ACTIVITY, Date.now().toString());
  }

  /**
   * Forces a flush of the data.
   */
  private forceFlush(): void {
    OpenTelemetryProvider.getInstance(this.config).forceFlush();
  }

  /**
   * Returns the session id.
   * @returns The session id.
   */
  public getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Returns the duration of the session.
   * @returns The duration of the session in milliseconds.
   */
  public getDuration(): number {
    // prettier-ignore
    return this.startTime
            ? Date.now() - this.startTime
            : 0;
  }

  /**
   * Returns the current active view information as an immutable snapshot.
   * @returns The active view info or null if no view is active.
   */
  public getActiveView(): ActiveViewInfo | null {
    if (!this.view) {
      return null;
    }

    return {
      id: this.view.getViewId(),
      url: this.view.getUrl(),
      startedAt: this.view.getStartTime() || Date.now(),
      durationMs: this.view.getDuration(),
    };
  }

  /**
   * Returns the view that was active at a specific timestamp.
   * For now, this returns the current view if it covers the timestamp,
   * or null otherwise. Future enhancement could maintain a view timeline.
   * @param timestamp - The timestamp to check (milliseconds since epoch)
   * @returns The view info that was active at the timestamp, or null if no view is active.
   */
  public getActiveViewAt(timestamp: number): ActiveViewInfo | null {
    const currentView = this.getActiveView();
    if (!currentView) {
      return null;
    }

    if (timestamp >= currentView.startedAt) {
      return currentView;
    }

    return null;
  }

  /**
   * Shuts down the session manager gracefully.
   */
  public shutdown(): void {
    this.end();
    this.clearInactivityTimeoutInterval();
    this.clearSessionId();
    this.clearLastActivityTime();
    this.clearActiveTabsCount();

    this.eventListeners.forEach((eventListener) => {
      eventListener.remove();
    });
    this.eventListeners = [];
  }
}
