import { Context, ContextManager, ROOT_CONTEXT, createContextKey } from '@opentelemetry/api';
import { rumLogger } from '../shared';

/**
 * Context Manager for propagating OpenTelemetry Context through common asynchronous browser APIs.
 * Holds current active session and view IDs, as well as custom attributes.
 */
export class LogzioContextManager implements ContextManager {
  private readonly SESSION_ID_KEY = createContextKey('logzio.rum.session_id');
  private readonly VIEW_ID_KEY = createContextKey('logzio.rum.view_id');
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
    this._currentContext = context || ROOT_CONTEXT;
    try {
      return fn.apply(thisArg, args);
    } finally {
      this._currentContext = previousContext;
    }
  }

  public bind<T>(context: Context, target: T): T {
    if (typeof target === 'function') {
      return function (this: any, ...args: unknown[]) {
        const manager = LogzioContextManager.getInstance();
        return manager.with(context, target as any, this, ...args);
      } as unknown as T;
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
   * Sets the current session/view context with session ID, view ID, and custom attributes.
   * Used by views to update the context for all future spans.
   */
  public setViewContext(sessionId: string, viewId: string): void {
    let ctx = ROOT_CONTEXT;
    ctx = ctx.setValue(this.SESSION_ID_KEY, sessionId);
    ctx = ctx.setValue(this.VIEW_ID_KEY, viewId);

    if (Object.keys(this._customAttributes).length > 0) {
      ctx = ctx.setValue(this.CUSTOM_ATTRIBUTES_KEY, { ...this._customAttributes });
    }

    this._currentContext = ctx;
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
   * Note: This only affects future spans - existing spans are not modified.
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
          // Use call-time context instead of schedule-time context
          const manager = LogzioContextManager.getInstance();
          const wrappedListener = function (this: any, ...evArgs: any[]) {
            // Get current active context at event execution time
            return manager.with(manager.active(), listener as any, this, ...evArgs);
          };

          // Store mapping for removeEventListener
          manager._listenerMap.set(listener, wrappedListener);

          return originalAddEventListener.call(this, type, wrappedListener, options);
        } else if (
          listener &&
          typeof listener === 'object' &&
          typeof (listener as EventListenerObject).handleEvent === 'function'
        ) {
          // Handle EventListenerObject case with call-time context
          const manager = LogzioContextManager.getInstance();
          const originalObj = listener as EventListenerObject;

          const wrappedFn = function (this: any, ...evArgs: any[]) {
            // Get current active context at event execution time
            const fn = originalObj.handleEvent.bind(originalObj);
            return manager.with(manager.active(), fn as any, this, ...evArgs);
          };

          manager._listenerMap.set(
            originalObj as unknown as EventListener,
            wrappedFn as unknown as EventListener,
          );

          return originalAddEventListener.call(
            this,
            type,
            wrappedFn as unknown as EventListener,
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
          const [callback, ...restArgs] = args;
          // Use call-time context instead of schedule-time context
          const wrappedCallback = (...cbArgs: any[]) => {
            return this.with(this.active(), callback, undefined, ...cbArgs);
          };
          return original(wrappedCallback, ...restArgs);
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
        // Use call-time context instead of schedule-time context
        const wrappedCallback = (time: DOMHighResTimeStamp) => {
          return this.with(this.active(), callback, undefined, time);
        };
        return original(wrappedCallback);
      };
    } catch (error) {
      rumLogger.error('Failed to patch requestAnimationFrame', error);
    }
  }

  /**
   * Helper to update active context when attributes change.
   */
  private updateActiveContext(): void {
    if (this._currentContext !== ROOT_CONTEXT) {
      const sessionId = this.getSessionId(this._currentContext);
      const viewId = this.getViewId(this._currentContext);

      if (sessionId && viewId) {
        this.setViewContext(sessionId, viewId);
      }
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
