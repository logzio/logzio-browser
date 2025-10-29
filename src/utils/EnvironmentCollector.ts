import { rumLogger, DEVICE_BREAKPOINTS } from '../shared';
import {
  ATTR_BROWSER_NAME,
  ATTR_BROWSER_VERSION,
  ATTR_USER_AGENT,
  ATTR_OS_NAME,
  ATTR_OS_VERSION,
  ATTR_DEVICE_TYPE,
  ATTR_DEVICE_SCREEN_WIDTH,
  ATTR_DEVICE_SCREEN_HEIGHT,
  ATTR_USER_LANGUAGE,
  ATTR_USER_TIMEZONE,
  DeviceType,
} from '../instrumentation/semconv';

// Extend the Navigator interface for NavigatorUAData, which might not be in all TypeScript environments (due to experimental flag).
// ref: https://developer.mozilla.org/en-US/docs/Web/API/Navigator/userAgentData
declare global {
  interface Navigator {
    userAgentData?: {
      brands: Array<{ brand: string; version: string }>;
      mobile: boolean;
      platform: string;
    };
  }
}

export interface EnvironmentData {
  browserName?: string;
  browserVersion?: string;
  osName?: string;
  osVersion?: string;
  deviceType?: DeviceType;
  userAgent?: string;
  language?: string;
  timezone?: string;
  screenWidth?: number;
  screenHeight?: number;
}

export interface EnvironmentAttributes {
  [key: string]: string | number;
}

export interface EnvironmentCollectionOptions {
  collectOS?: boolean;
  collectBrowser?: boolean;
  collectDevice?: boolean;
  collectLanguage?: boolean;
}

/**
 * Collects static environment information from the browser.
 * This data is collected once during SDK initialization and added to the OpenTelemetry Resource.
 */
export class EnvironmentCollector {
  /**
   * Collects environment data based on the provided options.
   * @param options - Configuration for what environment data to collect
   * @returns Object containing environment attributes
   */
  public static collect(options: EnvironmentCollectionOptions): EnvironmentAttributes {
    const envAttr: EnvironmentAttributes = {};

    try {
      const allEnvData = this.collectEnvData();

      if (options.collectBrowser) {
        if (allEnvData.userAgent) envAttr[ATTR_USER_AGENT] = allEnvData.userAgent;
        if (allEnvData.browserName) envAttr[ATTR_BROWSER_NAME] = allEnvData.browserName;
        if (allEnvData.browserVersion) envAttr[ATTR_BROWSER_VERSION] = allEnvData.browserVersion;
      }

      if (options.collectOS) {
        if (allEnvData.osName) envAttr[ATTR_OS_NAME] = allEnvData.osName;
        if (allEnvData.osVersion) envAttr[ATTR_OS_VERSION] = allEnvData.osVersion;
      }

      if (options.collectDevice) {
        if (allEnvData.deviceType) envAttr[ATTR_DEVICE_TYPE] = allEnvData.deviceType;
        if (allEnvData.screenWidth) envAttr[ATTR_DEVICE_SCREEN_WIDTH] = allEnvData.screenWidth;
        if (allEnvData.screenHeight) envAttr[ATTR_DEVICE_SCREEN_HEIGHT] = allEnvData.screenHeight;
      }

      if (options.collectLanguage) {
        if (allEnvData.language) envAttr[ATTR_USER_LANGUAGE] = allEnvData.language;
        if (allEnvData.timezone) envAttr[ATTR_USER_TIMEZONE] = allEnvData.timezone;
      }
    } catch (error) {
      rumLogger.error('Failed to collect environment data:', error);
    }

    return envAttr;
  }

  private static collectEnvData(): EnvironmentData {
    const result: EnvironmentData = {};
    const userAgent = navigator?.userAgent || '';
    const screenWidth = screen.width;
    const screenHeight = screen.height;

    // Collect screen dimensions
    const currScreenWidth = window.innerWidth;
    const currScreenHeight = window.innerHeight;
    if (currScreenWidth && currScreenHeight) {
      result.screenWidth = currScreenWidth;
      result.screenHeight = currScreenHeight;
    }

    // Collect data from user agent
    if (userAgent) {
      result.userAgent = userAgent;

      if (navigator.userAgentData) {
        const brand = navigator.userAgentData.brands.find((b) => !b.brand.includes('Not'))?.brand;
        const version = navigator.userAgentData.brands.find(
          (b) => !b.brand.includes('Not'),
        )?.version;

        if (brand) result.browserName = brand;
        if (version) result.browserVersion = version;
        if (navigator.userAgentData.platform) result.osName = navigator.userAgentData.platform;

        result.deviceType = this.getDeviceType(
          navigator.userAgentData.mobile,
          userAgent,
          screenWidth,
          screenHeight,
        );
      } else {
        const browserInfo = this.parseBrowserFromUserAgent(userAgent);
        if (browserInfo.name) result.browserName = browserInfo.name;
        if (browserInfo.version) result.browserVersion = browserInfo.version;

        const osInfo = this.parseOSFromUserAgent(userAgent);
        if (osInfo.name) result.osName = osInfo.name;
        if (osInfo.version) result.osVersion = osInfo.version;

        result.deviceType = this.getDeviceType(undefined, userAgent, screenWidth, screenHeight);
      }
    }

    // Collect non user agent related data
    const language = navigator?.language || '';
    if (language) result.language = language;

    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (timezone) result.timezone = timezone;
    } catch (error) {
      rumLogger.warn('Failed to collect timezone data:', error);
    }

    return result;
  }

  /**
   * Parses browser information from user agent string.
   */
  private static parseBrowserFromUserAgent(userAgent: string): { name?: string; version?: string } {
    const result: { name?: string; version?: string } = {};
    let match;

    // Match browser patterns and normalize to userAgentData.brands naming
    if ((match = userAgent.match(/Chrome\/([0-9.]+)/i)) && !userAgent.includes('Edg')) {
      result.name = 'Google Chrome';
      result.version = match[1];
    } else if ((match = userAgent.match(/Edg\/([0-9.]+)/i))) {
      result.name = 'Microsoft Edge';
      result.version = match[1];
    } else if ((match = userAgent.match(/Firefox\/([0-9.]+)/i))) {
      result.name = 'Firefox';
      result.version = match[1];
    } else if ((match = userAgent.match(/Opera\/([0-9.]+)/i))) {
      result.name = 'Opera';
      result.version = match[1];
    } else if ((match = userAgent.match(/Version\/([0-9.]+).*Safari/i))) {
      result.name = 'Safari';
      result.version = match[1];
    } else if ((match = userAgent.match(/SamsungBrowser\/([0-9.]+)/i))) {
      result.name = 'Samsung Internet';
      result.version = match[1];
    } else if ((match = userAgent.match(/CriOS\/([0-9.]+)/i))) {
      result.name = 'Google Chrome';
      result.version = match[1];
    } else if ((match = userAgent.match(/FxiOS\/([0-9.]+)/i))) {
      result.name = 'Firefox';
      result.version = match[1];
    }

    return result;
  }

  /**
   * Parses OS information from user agent string.
   */
  private static parseOSFromUserAgent(userAgent: string): { name?: string; version?: string } {
    const result: { name?: string; version?: string } = {};
    if (userAgent.includes('Windows')) {
      result.name = 'Windows';
      if (userAgent.includes('Windows NT 10.0')) result.version = '10';
    } else if (userAgent.includes('Macintosh')) {
      result.name = 'macOS';
    } else if (userAgent.includes('Linux')) {
      result.name = 'Linux';
    } else if (userAgent.includes('Android')) {
      result.name = 'Android';
    } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
      result.name = 'iOS';
    }
    return result;
  }

  /**
   * Consolidates all device type detection logic into a single, comprehensive method.
   */
  private static getDeviceType(
    isMobileFromUAData: boolean | undefined,
    userAgent: string,
    screenWidth: number,
    screenHeight: number,
  ): DeviceType {
    if (isMobileFromUAData !== undefined) {
      if (isMobileFromUAData) {
        return DeviceType.MOBILE;
      }
      return this.getDeviceTypeFromScreenSize(screenWidth, screenHeight);
    }

    if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
      return DeviceType.MOBILE;
    }
    if (userAgent.includes('iPad') || userAgent.includes('Tablet')) {
      return DeviceType.TABLET;
    }

    return this.getDeviceTypeFromScreenSize(screenWidth, screenHeight);
  }

  /**
   * Determines device type based on screen size.
   */
  private static getDeviceTypeFromScreenSize(
    screenWidth: number,
    screenHeight: number,
  ): DeviceType {
    const minDimension = Math.min(screenWidth, screenHeight);
    if (minDimension < DEVICE_BREAKPOINTS.MOBILE_MAX) return DeviceType.MOBILE;
    if (minDimension < DEVICE_BREAKPOINTS.TABLET_MAX) return DeviceType.TABLET;
    return DeviceType.DESKTOP;
  }
}
