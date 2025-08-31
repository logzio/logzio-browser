import {
  Context,
  ContextManager,
  ROOT_CONTEXT,
  createContextKey,
  trace,
  Span,
} from '@opentelemetry/api';
import { rumLogger } from '../shared';

/**
 * Context Manager for propagating OpenTelemetry Context through common asynchronous browser APIs.
 * Holds current active session and view IDs, as well as custom attributes.
 */
export class LogzioContextManager implements ContextManager {
  private readonly SESSION_ID_KEY = createContextKey('logzio.rum.session_id');
  private readonly VIEW_ID_KEY = createContextKey('logzio.rum.view_id');
  private readonly PAGE_VIEW_SPAN_KEY = createContextKey('logzio.rum.page_view_span');
  private readonly CUSTOM_ATTRIBUTES_KEY = createContextKey('logzio.rum.custom_attributes');

  private _currentContext: Context = ROOT_CONTEXT;
  private _enabled = false;
  private _customAttributes: Record<string, any> = {};
  private _originals: Array<() => void> = [];
  private _listenerMap = new WeakMap<EventListener, EventListener>();

  private static _instance: LogzioContextManager | null = null;

  private constructor() {}

  /**
   * Implements the singleton pattern.
   */
  public static getInstance(): LogzioContextManager {
    if (!LogzioContextManager._instance) {
      LogzioContextManager._instance = new LogzioContextManager();
    }
    return LogzioContextManager._instance;
  }

  public active(): Context {
    return this._currentContext;
  }

  public with<A extends unknown[], F extends (...args: A) => ReturnType<F>>(
    context: Context,
    fn: F,
    thisArg?: ThisParameterType<F>,
    ...args: A
  ): ReturnType<F> {
    const previousContext = this._currentContext;
    this._currentContext = context;
    try {
      return fn.apply(thisArg, args);
    } finally {
      this._currentContext = previousContext;
    }
  }

  public bind<T>(context: Context, target: T): T {
    if (typeof target === 'function') {
      return ((...args: unknown[]) => {
        return this.with(context, target as any, ...args);
      }) as unknown as T;
    }
    return target;
  }

  public enable(): this {
    if (this._enabled) return this;

    try {
      this._patchEventTarget();
      this._patchTimers();
      this._patchRAF();
      this._enabled = true;
      rumLogger.debug('LogzioContextManager enabled successfully');
    } catch (error) {
      rumLogger.error('Failed to enable LogzioContextManager', error);
    }

    return this;
  }

  public disable(): this {
    if (!this._enabled) return this;

    try {
      // Restore all original functions
      this._originals.forEach((restoreFunction) => restoreFunction());
      this._originals.length = 0;

      // Clear listener map
      this._listenerMap = new WeakMap<EventListener, EventListener>();

      this._enabled = false;
      this._currentContext = ROOT_CONTEXT;
      rumLogger.debug('LogzioContextManager disabled successfully');
    } catch (error) {
      rumLogger.error('Failed to disable LogzioContextManager', error);
    }

    return this;
  }

  /**
   * Sets the initial custom attributes that will be applied to all spans and logs.
   * This should be called once during SDK initialization.
   */
  public setInitialCustomAttributes(customAttributes: Record<string, any>): void {
    this._customAttributes = { ...this.flattenObject(customAttributes) };
  }

  /**
   * Sets the page view context with span, session ID, view ID, and custom attributes.
   */
  public setPageViewContext(span: Span, sessionId: string, viewId: string): void {
    // First, build the RUM context with session, view, and custom data
    let context = ROOT_CONTEXT;
    context = context.setValue(this.SESSION_ID_KEY, sessionId);
    context = context.setValue(this.VIEW_ID_KEY, viewId);
    context = context.setValue(this.PAGE_VIEW_SPAN_KEY, span);

    // Add custom attributes
    if (Object.keys(this._customAttributes).length > 0) {
      context = context.setValue(this.CUSTOM_ATTRIBUTES_KEY, { ...this._customAttributes });
    }

    // Then, set the active span on this RUM-enriched context
    this._currentContext = trace.setSpan(context, span);
  }

  public getSessionId(context: Context = this._currentContext): string | undefined {
    return context.getValue(this.SESSION_ID_KEY) as string | undefined;
  }

  public getViewId(context: Context = this._currentContext): string | undefined {
    return context.getValue(this.VIEW_ID_KEY) as string | undefined;
  }

  public getCustomAttributes(
    context: Context = this._currentContext,
  ): Record<string, any> | undefined {
    return context.getValue(this.CUSTOM_ATTRIBUTES_KEY) as Record<string, any> | undefined;
  }

  /**
   * Sets custom attributes that will be applied to all future spans and logs.
   * Replaces the entire custom attributes map.
   */
  public setCustomAttributes(attributes: Record<string, any>): void {
    this._customAttributes = { ...this.flattenObject(attributes) };
    this.updateActiveContext();
  }

  /**
   * Gets a copy of the current custom attributes.
   */
  public getCurrentCustomAttributes(): Record<string, any> {
    return { ...this._customAttributes };
  }

  /**
   * Patches the EventTarget object to propagate the active context.
   */
  private _patchEventTarget(): void {
    try {
      if (!globalThis.EventTarget) return;

      const originalAddEventListener = EventTarget.prototype.addEventListener;
      const originalRemoveEventListener = EventTarget.prototype.removeEventListener;

      const restore = () => {
        EventTarget.prototype.addEventListener = originalAddEventListener;
        EventTarget.prototype.removeEventListener = originalRemoveEventListener;
      };
      this._originals.push(restore);

      // Patch addEventListener
      EventTarget.prototype.addEventListener = function (
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions,
      ) {
        if (listener && typeof listener === 'function') {
          // Capture the current context when listener is registered
          const manager = LogzioContextManager.getInstance();
          const activeContext = manager.active();
          const boundListener = manager.bind(activeContext, listener);

          // Store mapping for removeEventListener
          manager._listenerMap.set(listener, boundListener);

          return originalAddEventListener.call(this, type, boundListener, options);
        } else if (listener && typeof listener === 'object' && listener.handleEvent) {
          // Handle EventListenerObject case
          const manager = LogzioContextManager.getInstance();
          const activeContext = manager.active();
          const boundHandleEvent = manager.bind(activeContext, listener.handleEvent);
          const boundListener = { ...listener, handleEvent: boundHandleEvent };

          manager._listenerMap.set(
            listener as unknown as EventListener,
            boundListener as unknown as EventListener,
          );

          return originalAddEventListener.call(
            this,
            type,
            boundListener as unknown as EventListener,
            options,
          );
        }

        return originalAddEventListener.call(this, type, listener, options);
      };

      // Patch removeEventListener
      EventTarget.prototype.removeEventListener = function (
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | EventListenerOptions,
      ) {
        if (listener) {
          // Use the bound listener if we have it
          const manager = LogzioContextManager.getInstance();
          const boundListener = manager._listenerMap.get(listener as EventListener);
          if (boundListener) {
            manager._listenerMap.delete(listener as EventListener);
            return originalRemoveEventListener.call(this, type, boundListener, options);
          }
        }

        return originalRemoveEventListener.call(this, type, listener, options);
      };
    } catch (error) {
      rumLogger.error('Failed to patch EventTarget', error);
    }
  }

  /**
   * Patches the timers to propagate the active context.
   */
  private _patchTimers(): void {
    const timerMethods = ['setTimeout', 'setInterval', 'requestIdleCallback'] as const;

    timerMethods.forEach((methodName) => {
      try {
        const original = (globalThis as any)[methodName];
        if (!original) return;

        const restore = () => {
          (globalThis as any)[methodName] = original;
        };
        this._originals.push(restore);

        (globalThis as any)[methodName] = (...args: any[]) => {
          // <-- Use an arrow function here
          const [callback, ...restArgs] = args;
          const boundCallback = this.bind(this.active(), callback);
          return original(boundCallback, ...restArgs);
        };
      } catch (error) {
        rumLogger.error(`Failed to patch ${methodName}`, error);
      }
    });
  }

  /**
   * Patches the requestAnimationFrame to propagate the active context.
   */
  private _patchRAF(): void {
    try {
      const original = globalThis.requestAnimationFrame;
      if (!original) return;

      const restore = () => {
        globalThis.requestAnimationFrame = original;
      };
      this._originals.push(restore);

      globalThis.requestAnimationFrame = (callback: FrameRequestCallback): number => {
        const boundCallback = this.bind(this.active(), callback);
        return original(boundCallback);
      };
    } catch (error) {
      rumLogger.error('Failed to patch requestAnimationFrame', error);
    }
  }

  /**
   * Helper to update active context when attributes change.
   */
  private updateActiveContext(): void {
    if (this._currentContext === ROOT_CONTEXT) return;

    const currentSpan = trace.getActiveSpan();
    const sessionId = this.getSessionId(this._currentContext);
    const viewId = this.getViewId(this._currentContext);

    if (currentSpan && sessionId && viewId) {
      this.setPageViewContext(currentSpan, sessionId, viewId);
    }
  }

  /**
   * Helper to flatten nested objects with dot notation.
   */
  private flattenObject(obj: Record<string, any>, prefix = ''): Record<string, string> {
    const flattened: Record<string, string> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else {
        flattened[newKey] = String(value);
      }
    }

    return flattened;
  }
}

export const rumContextManager = LogzioContextManager.getInstance();
