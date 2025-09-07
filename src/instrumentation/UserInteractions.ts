import { InstrumentationBase } from '@opentelemetry/instrumentation';
import { trace, Span, context } from '@opentelemetry/api';
import {
  AttributeNames as otelAttributeNames,
  UserInteractionInstrumentationConfig,
  EventName,
  ShouldPreventSpanCreation,
} from '@opentelemetry/instrumentation-user-interaction';
import { getElementXPath } from '@opentelemetry/sdk-trace-web';
import { TimeBoundQueue } from '../utils';
import { EventMonitor, EventsCounter } from '../utils/EventCounter';
import { DOM_EVENT, EventListener, rumLogger, CLICK_ACTIVITY_EVENTS } from '../shared';
import { RUMConfig } from '../config';
import {
  ATTR_FRUSTRATION_RAGE_CLICKS_COUNT,
  ATTR_FRUSTRATION_TYPE,
  FrustrationType,
  SpanName,
} from './semconv';
import { NavigationTracker, NavigationEventType, NavigationEventData } from './trackers';

/* If we want to support monitoring other events in the future. */
const DEFAULT_INSTRUMENTED_EVENTS: EventName[] = [DOM_EVENT.CLICK];

// All events we can potentially track - setup listeners for all, filter at runtime
const ALL_TRACKABLE_USER_EVENTS: EventName[] = [
  DOM_EVENT.CLICK,
  // Currently the _eventNames is not configurable in the config so we can monitor only the filtered events
  // DOM_EVENT.MOUSE_DOWN,
  // DOM_EVENT.MOUSE_UP,
  // DOM_EVENT.KEY_DOWN,
  // DOM_EVENT.KEY_UP,
  // DOM_EVENT.FOCUS,
  // DOM_EVENT.BLUR,
  // DOM_EVENT.SUBMIT,
  // DOM_EVENT.TOUCH_START,
];

interface HistoryClick {
  timestamp: number;
  targetElement: string;
}

interface ClickEvent {
  span: Span;
  startTime: number;
  targetElement: string;
  frustrationTypes: FrustrationType[];
  counter: EventMonitor;
}

function defaultShouldPreventSpanCreation() {
  return false;
}

interface LogzioUserInteractionInstrumentationConfig extends UserInteractionInstrumentationConfig {
  frustrationThresholds: RUMConfig['frustrationThresholds'];
  trackNavigation?: boolean;
}

export class LogzioUserInteractionInstrumentation extends InstrumentationBase<LogzioUserInteractionInstrumentationConfig> {
  private static readonly NAME = 'user-interactions';
  private static readonly VERSION = '1.0.0';

  private _eventNames: Set<EventName> = new Set(DEFAULT_INSTRUMENTED_EVENTS);
  private _shouldPreventSpanCreation: ShouldPreventSpanCreation;

  private readonly RAGE_CLICK_THRESHOLD_COUNT: number;
  private readonly RAGE_CLICK_THRESHOLD_INTERVAL_MS: number;

  private eventListeners: EventListener[] = [];
  private clickHistory: TimeBoundQueue<HistoryClick> | null = null;
  private navigationUnsubscribe: (() => void) | null = null;
  private trackNavigation?: boolean;
  private navEvent: NavigationEventData | null = null;

  constructor(config: LogzioUserInteractionInstrumentationConfig) {
    super(
      LogzioUserInteractionInstrumentation.NAME,
      LogzioUserInteractionInstrumentation.VERSION,
      config,
    );

    this._eventNames = new Set(config?.eventNames ?? DEFAULT_INSTRUMENTED_EVENTS);
    this._shouldPreventSpanCreation =
      typeof config?.shouldPreventSpanCreation === 'function'
        ? config.shouldPreventSpanCreation
        : defaultShouldPreventSpanCreation;

    this.RAGE_CLICK_THRESHOLD_COUNT = config.frustrationThresholds!.rageClickCount;
    this.RAGE_CLICK_THRESHOLD_INTERVAL_MS = config.frustrationThresholds!.rageClickIntervalMs;

    this.trackNavigation = config.trackNavigation;
    this.clickHistory = new TimeBoundQueue<HistoryClick>(this.RAGE_CLICK_THRESHOLD_INTERVAL_MS);
  }

  public init(): void {
    // This method is called during instrumentation registration
    // The actual setup happens in enable()
  }

  public enable(): void {
    this.setupEventListeners();

    const navigationTracker = NavigationTracker.getInstance();
    this.navigationUnsubscribe = navigationTracker.subscribe(
      NavigationEventType.STARTED,
      this.onNavigation.bind(this),
    );
  }

  public disable(): void {
    this.removeEventsListeners();
    this.unsubscribeFromNavigation();
  }

  /**
   * Sets up the event listeners.
   * OTEL pattern: Setup listeners for ALL trackable events to avoid constructor timing issues.
   * Configuration filtering happens at event handling time.
   */
  private setupEventListeners(): void {
    // Ensure eventListeners is initialized (defensive programming for constructor timing)
    if (!this.eventListeners) {
      this.eventListeners = [];
    }

    ALL_TRACKABLE_USER_EVENTS.forEach((eventName) => {
      const eventListener = new EventListener<Event>();
      eventListener.set(window, eventName as DOM_EVENT, this.onClick.bind(this));
      this.eventListeners.push(eventListener);
    });
  }

  /**
   * Removes the event listeners.
   */
  private removeEventsListeners(): void {
    this.eventListeners.forEach((eventListener) => {
      eventListener.remove();
    });
    this.eventListeners = [];
  }

  /**
   * Unsubscribes from the navigation tracker.
   */
  private unsubscribeFromNavigation(): void {
    if (this.navigationUnsubscribe) {
      this.navigationUnsubscribe();
      this.navigationUnsubscribe = null;
    }
  }

  /**
   * Starts a new span if the provided event should create one.
   * @param element the interacted element
   * @param eventName the name of the event that triggered the span
   * @returns the generated span or undefined if no span started.
   */
  private createSpan(
    element: EventTarget | null | undefined,
    eventName: EventName,
    parentSpan?: Span,
  ): Span | undefined {
    if (!(element instanceof HTMLElement)) {
      return undefined;
    }
    if (!element.getAttribute) {
      return undefined;
    }
    if (element.hasAttribute('disabled')) {
      return undefined;
    }
    if (!this._eventNames.has(eventName)) {
      return undefined;
    }

    let spanName: string = SpanName.CLICK;
    let url = window.location.href;
    if (this.navEvent) {
      const formattedUrl = this.formatUrlForNavigation(this.navEvent.newUrl);
      spanName = `${SpanName.NAVIGATION}: ${formattedUrl}`;
      url = this.navEvent.oldUrl;
      this.navEvent = null;
    }

    const xpath = getElementXPath(element, true);
    try {
      const span = this.tracer.startSpan(
        spanName,
        {
          attributes: {
            [otelAttributeNames.EVENT_TYPE]: eventName,
            [otelAttributeNames.TARGET_ELEMENT]: element.tagName,
            [otelAttributeNames.TARGET_XPATH]: xpath,
            [otelAttributeNames.HTTP_URL]: url,
          },
        },
        // prettier-ignore
        parentSpan
          ? trace.setSpan(context.active(), parentSpan)
          : undefined,
      );

      // Ensure _shouldPreventSpanCreation is initialized (defensive programming for constructor timing)
      if (!this._shouldPreventSpanCreation) {
        this._shouldPreventSpanCreation = defaultShouldPreventSpanCreation;
      }

      if (this._shouldPreventSpanCreation(eventName, element, span) === true) {
        return undefined;
      }

      return span;
    } catch (e) {
      rumLogger.error('failed to start create new user interaction span', e);
    }
    return undefined;
  }

  /**
   * Handles the click event.
   * @param event the click event.
   */
  private onClick(event: Event): void {
    if (!this._eventNames.has(event.type as EventName)) {
      return;
    }

    const now = Date.now();
    const target = event?.target;

    const span = this.createSpan(target, SpanName.CLICK);
    if (!span) {
      return;
    }

    const click = this.createNewClickEvent(span, target as HTMLElement, now);
    this.addClickToHistory(click);
    this.isRageClick(click);
    this.finalizeClick(click);
  }

  /**
   * Creates a new click event structure.
   * @param span the span representing the click event.
   * @param target the target element of the click event.
   * @param startTime the start time of the click event.
   * @returns new click event.
   */
  private createNewClickEvent(span: Span, target: HTMLElement, startTime: number): ClickEvent {
    return {
      span,
      startTime: startTime,
      targetElement: target.tagName,
      frustrationTypes: [],
      counter: new EventMonitor(CLICK_ACTIVITY_EVENTS),
    };
  }

  /**
   * Adds a click to the click history.
   * @param click the click event to add to the history.
   */
  private addClickToHistory(click: ClickEvent): void {
    const clickEntry: HistoryClick = {
      timestamp: click.startTime,
      targetElement: click.targetElement,
    };
    this.clickHistory?.push(clickEntry);
  }

  /**
   * Indicates to the active span that it caused a navigation.
   * @param event the navigation event details.
   */
  private onNavigation(event: NavigationEventData): void {
    if (this.trackNavigation) {
      this.navEvent = event;
    }
  }

  /**
   * Marks the given click as a rage click if the counters indicate a rage click.
   * @param click the click event to check.
   */
  private isRageClick(click: ClickEvent): void {
    const recentClicks = this.clickHistory
      ?.values()
      .filter(
        (c) =>
          click.startTime - c.timestamp <= this.RAGE_CLICK_THRESHOLD_INTERVAL_MS &&
          c.targetElement === click.targetElement,
      );

    if (recentClicks && recentClicks.length >= this.RAGE_CLICK_THRESHOLD_COUNT) {
      click.frustrationTypes.push(FrustrationType.RAGE_CLICK);
      click.span.setAttribute(ATTR_FRUSTRATION_RAGE_CLICKS_COUNT, recentClicks.length);
    }
  }

  /**
   * Marks the given click as an error click if the counters indicate an error.
   * @param click the click event to check.
   * @param counters the counters of the click event.
   */
  private isErrorClick(click: ClickEvent, counters: EventsCounter): void {
    if (counters.errors > 0) {
      click.frustrationTypes.push(FrustrationType.ERROR_CLICK);
    }
  }

  /**
   * Marks the given click as a dead click if the counters indicate a dead click.
   * @param click the click event to check.
   * @param counters the counters of the click event.
   */
  private isDeadClick(click: ClickEvent, counters: EventsCounter): void {
    if (counters.activities === 0) {
      click.frustrationTypes.push(FrustrationType.DEAD_CLICK);
    }
  }

  /**
   * Finalizes the click event. which includes:
   * 1. checking and setting frustration signs
   * 2. ending the span
   * @param click the click event to finalize.
   */
  private finalizeClick(click: ClickEvent): void {
    const counters = click.counter.stop();
    this.isErrorClick(click, counters);
    if (click.span.spanContext.name === SpanName.CLICK) {
      this.isDeadClick(click, counters);
    }

    if (click.frustrationTypes.length > 0) {
      click.span.setAttribute(ATTR_FRUSTRATION_TYPE, click.frustrationTypes);
    }

    click.span.end();
  }

  /**
   * Formats a full URL to match OTEL's navigation URL format.
   * @param fullUrl the full URL to format
   * @returns formatted URL in OTEL format: pathname + hash + search
   */
  private formatUrlForNavigation(fullUrl: string): string {
    try {
      const url = new URL(fullUrl);
      return `${url.pathname}${url.hash}${url.search}`;
    } catch (error) {
      // Fallback to original URL if parsing fails
      return fullUrl;
    }
  }
}
