/**
 * Shared mocking utilities for EnvironmentCollector tests
 */

export interface MockNavigatorConfig {
  userAgent?: string;
  language?: string;
  userAgentData?: {
    brands: Array<{ brand: string; version: string }>;
    mobile: boolean;
    platform: string;
  };
}

export interface MockWindowScreenConfig {
  width?: number;
  height?: number;
  devicePixelRatio?: number;
}

export interface MockIntlConfig {
  timezone?: string;
}

/**
 * Stores original globals for restoration
 */
export const originalGlobals = {
  navigator: global.navigator,
  window: global.window,
  screen: global.screen,
  intl: global.Intl,
};

/**
 * Mock navigator with specified configuration
 */
export function mockNavigator(config: MockNavigatorConfig) {
  const navigatorValue: any = {
    userAgent: config.userAgent || '',
    userAgentData: config.userAgentData,
  };

  // Only set language if it's explicitly provided, allow undefined to stay undefined
  if (Object.prototype.hasOwnProperty.call(config, 'language')) {
    navigatorValue.language = config.language;
  } else {
    navigatorValue.language = 'en-US';
  }

  if (typeof navigator !== 'undefined') {
    // In jsdom environment, modify navigator properties directly
    Object.defineProperty(navigator, 'userAgent', {
      value: navigatorValue.userAgent,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'userAgentData', {
      value: navigatorValue.userAgentData,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(navigator, 'language', {
      value: navigatorValue.language,
      writable: true,
      configurable: true,
    });
  } else {
    // Fallback for node environment
    Object.defineProperty(global, 'navigator', {
      value: navigatorValue,
      writable: true,
      configurable: true,
    });
  }
}

/**
 * Mock window and screen objects
 */
export function mockWindowAndScreen(config: MockWindowScreenConfig) {
  const { width = 1920, height = 1080, devicePixelRatio = 1 } = config;

  // In jsdom environment, window already exists, so we modify it directly
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'innerWidth', {
      value: width,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: height,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'screenWidth', {
      value: width,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'screenHeight', {
      value: height,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, 'devicePixelRatio', {
      value: devicePixelRatio,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'screen', {
      value: {
        width,
        height,
      },
      writable: true,
      configurable: true,
    });
  } else {
    // Fallback for node environment
    Object.defineProperty(global, 'window', {
      value: {
        innerWidth: width,
        innerHeight: height,
        screenWidth: width,
        screenHeight: height,
        devicePixelRatio,
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(global, 'screen', {
      value: {
        width,
        height,
      },
      writable: true,
      configurable: true,
    });
  }
}

/**
 * Mock Intl object
 */
export function mockIntl(config: MockIntlConfig = {}) {
  const { timezone = 'America/New_York' } = config;

  Object.defineProperty(global, 'Intl', {
    value: {
      DateTimeFormat: jest.fn().mockReturnValue({
        resolvedOptions: () => ({ timeZone: timezone }),
      }),
    },
    writable: true,
    configurable: true,
  });
}

/**
 * Restore all original globals
 */
export function restoreGlobals() {
  // In jsdom environment, we don't need to restore global properties
  // The environment handles this automatically
  if (typeof window === 'undefined') {
    // Only restore in node environment
    Object.defineProperty(global, 'navigator', {
      value: originalGlobals.navigator,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'window', {
      value: originalGlobals.window,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'screen', {
      value: originalGlobals.screen,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(global, 'Intl', {
      value: originalGlobals.intl,
      writable: true,
      configurable: true,
    });
  }
}

/**
 * Standard setup for EnvironmentCollector tests
 */
export function setupEnvironmentMocks() {
  mockNavigator({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    language: 'en-US',
  });
  mockWindowAndScreen({});
  mockIntl();
}
