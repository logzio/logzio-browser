export interface TestConfigOverrides {
  tokens?: {
    traces: string;
    metrics?: string;
    logs?: string;
  };
  enable?: {
    userActions?: boolean;
    documentLoad?: boolean;
    resourceLoad?: boolean;
    errorTracking?: boolean;
    consoleLogs?: boolean;
    frustrationDetection?: boolean;
    navigation?: boolean;
    webVitals?: boolean;
    viewEvents?: boolean;
  };
  propagateTraceHeaderCorsUrls?: string[];
  service?: {
    name: string;
    version?: string;
  };
  region?: string;
  environmentData?: {
    collectOS?: boolean;
    collectBrowser?: boolean;
    collectDevice?: boolean;
    collectLanguage?: boolean;
  };
  frustrationThresholds?: {
    heavyLoadThresholdMs?: number;
  };
  session?: {
    maxDurationMs?: number;
    timeoutMs?: number;
  };
  customAttributes?: Record<string, any>;
  endpoint: {
    url: string;
    addSuffix?: boolean;
  };
  samplingRate?: number;
}

/**
 * Creates a valid RUM configuration for testing
 */
export function createConfig(overrides: Partial<TestConfigOverrides> = {}) {
  return {
    tokens: {
      traces: 'trace-token',
      metrics: 'metrics-token',
      ...overrides.tokens,
    },
    enable: {
      userActions: false,
      documentLoad: false,
      resourceLoad: false,
      errorTracking: false,
      consoleLogs: false,
      frustrationDetection: false,
      ...overrides.enable,
    },
    propagateTraceHeaderCorsUrls: [],
    service: {
      name: 'test-service',
      version: '1.0.0',
      ...overrides.service,
    },
    region: 'us-east-1',
    endpoint: {
      url: 'https://whatever/third/party/logzio/endpoint',
      addSuffix: true,
      ...overrides.endpoint,
    },
    environmentData: {
      collectOS: true,
      collectBrowser: true,
      collectDevice: true,
      collectLanguage: true,
      ...overrides.environmentData,
    },
    frustrationThresholds: {
      heavyLoadThresholdMs: 5000,
      ...overrides.frustrationThresholds,
    },
    session: {
      maxDurationMs: 2000,
      timeoutMs: 1500,
      ...overrides.session,
    },
    customAttributes: {},
    samplingRate: 100,
    ...overrides,
  };
}
