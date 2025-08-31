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
}

/**
 * This array represents events that indicate user activity.
 */
export const ACTIVITY_EVENTS: DOM_EVENT[] = [
  DOM_EVENT.CLICK,
  DOM_EVENT.MOUSE_DOWN,
  DOM_EVENT.KEY_DOWN,
  DOM_EVENT.SCROLL,
  DOM_EVENT.TOUCH_START,
];

/**
 * This array represents the activities that indicate a click event caused action.
 */
export const CLICK_ACTIVITY_EVENTS: DOM_EVENT[] = [
  DOM_EVENT.FETCH,
  DOM_EVENT.XHR,
  DOM_EVENT.SUBMIT,
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
