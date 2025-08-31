export interface RUMConfigOptions {
  region: string;
  tokens: {
    logs?: string;
    metrics?: string;
    traces: string;
  };
  service?: {
    name: string;
    version?: string;
  };
  session?: {
    maxDurationMs?: number;
    timeoutMs?: number;
  };
  enable?: {
    userActions?: boolean;
    navigation?: boolean; // if enabled, would start new view based on SPA route changes
    documentLoad?: boolean; // Enables the initial page load span
    resourceLoad?: boolean; // XHR, fetch, scripts, images
    errorTracking?: boolean; // stacktraces, errors from API
    frustrationDetection?: boolean; // rage clicks, dead clicks, heavy load
    webVitals?: boolean; // FCP, LCP, TTFB, CLS, FID, TTI
    viewEvents?: boolean; // view end event containing the duration to indicate the session state
    consoleLogs?: boolean; // console logs instrumentation flag
    // sessionReplay?: boolean; // DOM recording, user interactions  // consider doing this in future version
  };
  environmentData?: {
    collectOS?: boolean; // operating system name, version, type
    collectBrowser?: boolean; // browser name, version, engine
    collectDevice?: boolean; // device type, screen dimensions
    collectLanguage?: boolean; // user language and timezone
  };
  customAttributes?: Record<string, any>;
  propagateTraceHeaderCorsUrls?: (string | RegExp)[];
  samplingRate?: number;
  frustrationThresholds?: {
    rageClickCount?: number;
    rageClickIntervalMs?: number;
    heavyLoadThresholdMs?: number;
  };
  customEndpoint?: {
    url?: string;
    addSuffix?: boolean;
  };
  logLevel?: string;
}
