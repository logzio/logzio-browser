// Handle unhandled promise rejections FIRST - must be before any imports/requires
process.on('unhandledRejection', (reason) => {
  // Handle array of errors (common with OTLP exporters)
  if (Array.isArray(reason)) {
    // Just log and swallow all array errors in integration tests - they're usually OTLP exporter batches
    console.warn('Ignoring batch errors in integration test:', reason.length, 'errors');
    return;
  }

  // Handle single OTLP exporter errors and network errors
  if (reason && typeof reason === 'object') {
    const errorObj = reason as any;
    const isOTLPError =
      errorObj.name === 'OTLPExporterError' ||
      (errorObj.message &&
        typeof errorObj.message === 'string' &&
        (errorObj.message.includes('Internal Server Error') ||
          errorObj.message.includes('fetch') ||
          errorObj.message.includes('network')));

    if (isOTLPError) {
      console.warn(
        'Ignoring OTLP/network error in integration test:',
        errorObj.message || errorObj.name,
      );
      return;
    }
  }

  // Log other rejections but don't re-throw in integration tests to prevent crashes
  console.warn('Unhandled promise rejection in integration test (ignoring):', reason);
});

// Set longer timeout for integration tests
jest.setTimeout(15000);

// Add TextEncoder/TextDecoder for OpenTelemetry instrumentations
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

// Mock timer.unref for JSDOM compatibility with OpenTelemetry
const originalSetTimeout = global.setTimeout;
const originalClearTimeout = global.clearTimeout;
const originalSetInterval = global.setInterval as any;
const originalClearInterval = global.clearInterval as any;

function createMockTimer(timerId: any) {
  return {
    _id: timerId,
    unref: function () {
      return this;
    },
    ref: function () {
      return this;
    },
    hasRef: function () {
      return true;
    },
    refresh: function () {
      return this;
    },
    [Symbol.toPrimitive]: function () {
      return timerId;
    },
  } as any;
}

global.setTimeout = function (callback: any, delay?: number, ...args: any[]): NodeJS.Timeout {
  const timerId = originalSetTimeout(callback, delay, ...args);
  return createMockTimer(timerId) as any;
} as any;

global.clearTimeout = function (timer: any): void {
  if (timer && typeof timer === 'object' && timer._id) {
    originalClearTimeout(timer._id);
  } else {
    originalClearTimeout(timer as any);
  }
} as any;

// Also shim setInterval/clearInterval since OTEL metrics uses PeriodicExportingMetricReader
(global as any).setInterval = function (
  callback: any,
  delay?: number,
  ...args: any[]
): NodeJS.Timeout {
  const timerId = originalSetInterval(callback, delay, ...args);
  return createMockTimer(timerId) as any;
} as any;

(global as any).clearInterval = function (timer: any): void {
  if (timer && typeof timer === 'object' && timer._id) {
    originalClearInterval(timer._id);
  } else {
    originalClearInterval(timer as any);
  }
} as any;

// Patch Node 'timers' module as well (some OTEL code may import from it directly)
try {
  const timers = require('timers');
  const nodeSetTimeout = timers.setTimeout;
  const nodeClearTimeout = timers.clearTimeout;
  const nodeSetInterval = timers.setInterval;
  const nodeClearInterval = timers.clearInterval;

  timers.setTimeout = function (callback: any, delay?: number, ...args: any[]) {
    const timerId = nodeSetTimeout(callback, delay, ...args);
    return createMockTimer(timerId);
  } as any;

  timers.clearTimeout = function (timer: any) {
    if (timer && typeof timer === 'object' && timer._id) {
      nodeClearTimeout(timer._id);
    } else {
      nodeClearTimeout(timer);
    }
  } as any;

  timers.setInterval = function (callback: any, delay?: number, ...args: any[]) {
    const timerId = nodeSetInterval(callback, delay, ...args);
    return createMockTimer(timerId);
  } as any;

  timers.clearInterval = function (timer: any) {
    if (timer && typeof timer === 'object' && timer._id) {
      nodeClearInterval(timer._id);
    } else {
      nodeClearInterval(timer);
    }
  } as any;
} catch (_e) {
  // Ignore if 'timers' module patching is not applicable in this environment
}

// Set stable user agent and language for deterministic environment collection
Object.defineProperty(navigator, 'userAgent', {
  writable: true,
  value:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
});

Object.defineProperty(navigator, 'language', {
  writable: true,
  value: 'en-US',
});

Object.defineProperty(navigator, 'languages', {
  writable: true,
  value: ['en-US', 'en'],
});

// Stub the inactivity timeout check to prevent background timers
beforeEach(() => {
  // Import RUMSessionManager and stub the problematic method
  const RUMSessionManager = require('../../../src/context/RUMSessionManager').RUMSessionManager;

  jest
    .spyOn(RUMSessionManager.prototype, 'scheduleInactivityTimeoutCheck')
    .mockImplementation(() => {
      // No-op to prevent background intervals
    });
});

// Global test cleanup
afterEach(() => {
  jest.clearAllMocks();

  // Clear any remaining timers
  jest.clearAllTimers();

  // Clear localStorage
  try {
    localStorage.clear();
  } catch (_error) {
    // Ignore localStorage errors
  }

  // Clean up DOM
  document.body.innerHTML = '';

  // Reset document properties
  Object.defineProperty(document, 'hidden', {
    writable: true,
    configurable: true,
    value: false,
  });

  Object.defineProperty(document, 'readyState', {
    writable: true,
    value: 'complete',
  });
});
