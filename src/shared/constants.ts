/**
 * This enum represents DOM events.
 */
export const enum DOM_EVENT {
  CLICK = 'click',
  MOUSE_DOWN = 'mousedown',
  MOUSE_UP = 'mouseup',
  KEY_DOWN = 'keydown',
  KEY_UP = 'keyup',
  FOCUS = 'focus',
  BLUR = 'blur',
  VISIBILITY_CHANGE = 'visibilitychange',
  BEFORE_UNLOAD = 'beforeunload',
  LOAD = 'load',
  ERROR = 'error',
  STORAGE = 'storage',
  POP_STATE = 'popstate',
  PUSH_STATE = 'pushState',
  REPLACE_STATE = 'replaceState',
  BACK = 'back',
  FORWARD = 'forward',
  GO = 'go',
  SCROLL = 'scroll',
  TOUCH_START = 'touchstart',
  UNHANDLED_REJECTION = 'unhandledrejection',
  FETCH = 'fetch',
  XHR = 'xhr',
  SUBMIT = 'submit',
  HAS_CHANGED = 'haschanged',
  CHANGE = 'change',
  INPUT = 'input',
  DOM_MUTATION = 'dom_mutation',
}

/**
 * This array represents events that indicate user activity for session management.
 * These events will prevent session timeout when detected.
 */
export const ACTIVITY_EVENTS: DOM_EVENT[] = [
  DOM_EVENT.CLICK,
  DOM_EVENT.MOUSE_DOWN,
  DOM_EVENT.KEY_DOWN,
  DOM_EVENT.SCROLL,
  DOM_EVENT.TOUCH_START,
  DOM_EVENT.INPUT,
];

/**
 * This array represents the activities that indicate a click event caused action.
 * These events are monitored within the click's idle window for dead click detection.
 */
export const CLICK_ACTIVITY_EVENTS: DOM_EVENT[] = [
  DOM_EVENT.FETCH,
  DOM_EVENT.XHR,
  DOM_EVENT.SUBMIT,
  DOM_EVENT.INPUT,
  DOM_EVENT.FOCUS,
  DOM_EVENT.BLUR,
  DOM_EVENT.CHANGE,
  DOM_EVENT.DOM_MUTATION,
];

/**
 * Device type breakpoints based on screen dimensions.
 * These follow common responsive design conventions.
 */
export const DEVICE_BREAKPOINTS = {
  /** Maximum width/height for mobile devices */
  MOBILE_MAX: 768,
  /** Maximum width/height for tablet devices */
  TABLET_MAX: 1024,
} as const;

/**
 * This constant represents the name of the RUM provider.
 */
export const LOGZIO_RUM_PROVIDER_NAME = 'logzio-rum';

/**
 * MutationObserver configuration constants
 */
export const MUTATION_IGNORED_TAGS = ['script', 'style', 'meta', 'link', 'title'] as const;
export const MUTATION_SIGNIFICANT_ATTRIBUTES = ['class', 'style', 'hidden', 'disabled'] as const;

/**
 * Dead click detection timing constants (in milliseconds)
 */
export const DEAD_CLICK_FINALIZATION_DELAY_MS = 1000; // Maximum time to wait for effects
export const DEAD_CLICK_IDLE_WINDOW_MS = 200; // Time to wait for additional effects after last activity
