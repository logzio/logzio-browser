/* Session attributes */
export const ATTR_SESSION_ID = 'session.id';
export const ATTR_VIEW_ID = 'view.id';

/* User context attributes */
export const ATTR_USER_CONTEXT = 'user.context';
export const ATTR_CUSTOM_ATTRIBUTES = 'custom.attributes';

/* User interaction attributes */
export const ATTR_TARGET_ARIA_LABEL = 'target_aria_label';

/* URL request path attributes */
export const ATTR_REQUEST_PATH = 'request.path';

/* Frustration attributes */
export const ATTR_FRUSTRATION_TYPE = 'frustration.type';
export const ATTR_FRUSTRATION_DEAD_CLICK = 'frustration.dead_click';
export const ATTR_FRUSTRATION_RAGE_CLICK = 'frustration.rage_click';
export const ATTR_FRUSTRATION_HEAVY_LOAD = 'frustration.heavy_load';
export const ATTR_FRUSTRATION_ERROR_CLICK = 'frustration.error_click';
export const ATTR_FRUSTRATION_RAGE_CLICKS_COUNT = 'frustration.rage_clicks_count';

/* Frustration types */
export const enum FrustrationType {
  RAGE_CLICK = 'rage_click',
  HEAVY_LOAD = 'heavy_load',
  ERROR_CLICK = 'error_click',
  DEAD_CLICK = 'dead_click',
}

/* Console attributes */
export const ATTR_CONSOLE_STACK_TRACE = 'console.stack_trace';

/* Environment attributes - Static (Resource level) */
export const ATTR_BROWSER_NAME = 'browser.name';
export const ATTR_BROWSER_VERSION = 'browser.version';
export const ATTR_USER_AGENT = 'user_agent'; // Full user agent string
export const ATTR_OS_NAME = 'os.name';
export const ATTR_OS_VERSION = 'os.version';
export const ATTR_DEVICE_TYPE = 'device.type';
export const ATTR_DEVICE_SCREEN_WIDTH = 'device.screen.width';
export const ATTR_DEVICE_SCREEN_HEIGHT = 'device.screen.height';
export const ATTR_USER_LANGUAGE = 'user.language';
export const ATTR_USER_TIMEZONE = 'user.timezone';

/* Device types */
export const enum DeviceType {
  MOBILE = 'mobile',
  TABLET = 'tablet',
  DESKTOP = 'desktop',
}

/* Common span names */
export const enum SpanName {
  RUNTIME_EXCEPTION = 'runtime.exception',
  APP_EXCEPTION = 'app.exception',
  RUM_EXCEPTION = 'rum.exception',
  NAVIGATION = 'Navigation',
  CLICK = 'click',
}
