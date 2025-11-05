import {
  DEFAULT_SERVICE_NAME,
  DEFAULT_SERVICE_VERSION,
  DEFAULT_SESSION_TIMEOUT_MS,
  DEFAULT_ENABLE_STATE,
  DEFAULT_SAMPLE_RATE,
  DEFAULT_RAGE_CLICK_COUNT,
  DEFAULT_RAGE_CLICK_INTERVAL_MS,
  DEFAULT_HEAVY_LOAD_THRESHOLD_MS,
  DEFAULT_SESSION_MAX_DURATION_MS,
} from '@src/config/defaults';
import { RUMConfig } from '@src/config';
import { LogLevel } from '@src/shared';

// Mock shared dependencies using centralized helper
jest.mock('@src/shared', () => {
  const { createSharedMock } = require('../__utils__/loggerMocks');
  return createSharedMock();
});

describe('RUMConfig', () => {
  it('should create a valid RUMConfig with default values', () => {
    const confOptions = {
      region: 'eu',
      tokens: {
        traces: 'trace-token',
        logs: 'logs-token',
      },
      endpoint: {
        url: 'https://example.com',
      },
    };
    const config = new RUMConfig(confOptions);
    expect(config.region).toBe(confOptions.region);
    expect(config.tokens.logs).toBe(confOptions.tokens.logs);
    expect(config.tokens.traces).toBe(confOptions.tokens.traces);
    expect(config.service!.name).toBe(DEFAULT_SERVICE_NAME);
    expect(config.service!.version).toBe(DEFAULT_SERVICE_VERSION);
    expect(config.session!.maxDurationMs).toBe(DEFAULT_SESSION_MAX_DURATION_MS);
    expect(config.session!.timeoutMs).toBe(DEFAULT_SESSION_TIMEOUT_MS);
    expect(config.enable!.errorTracking).toBe(DEFAULT_ENABLE_STATE);
    expect(config.enable!.frustrationDetection).toBe(DEFAULT_ENABLE_STATE);
    expect(config.enable!.webVitals).toBe(DEFAULT_ENABLE_STATE);
    expect(config.samplingRate).toBe(DEFAULT_SAMPLE_RATE);
    expect(config.customAttributes).toEqual({});
    expect(config.frustrationThresholds!.rageClickCount).toBe(DEFAULT_RAGE_CLICK_COUNT);
    expect(config.frustrationThresholds!.rageClickIntervalMs).toBe(DEFAULT_RAGE_CLICK_INTERVAL_MS);
    expect(config.frustrationThresholds!.heavyLoadThresholdMs).toBe(
      DEFAULT_HEAVY_LOAD_THRESHOLD_MS,
    );
  });

  it('should override default values with provided config', () => {
    const customConfig = {
      region: 'us',
      tokens: { logs: 'log-token', traces: 'trace-token' },
      endpoint: { url: 'https://custom.endpoint.com' },
      service: { name: 'test', version: '1.2.3' },
      session: { maxDurationMs: 7200, timeoutMs: 600_000 },
      enable: {
        errorTracking: false,
        frustrationDetection: true,
        webVitals: false,
        // sessionReplay: true,
      },
      samplingRate: 50,
      customAttributes: { userId: '12345' },
    };

    const config = new RUMConfig(customConfig);

    expect(config.region).toBe(customConfig.region);
    expect(config.tokens.logs).toBe(customConfig.tokens.logs);
    expect(config.tokens.traces).toBe(customConfig.tokens.traces);
    expect(config.service!.name).toBe(customConfig.service.name);
    expect(config.service!.version).toBe(customConfig.service.version);
    expect(config.session!.maxDurationMs).toBe(customConfig.session.maxDurationMs);
    expect(config.session!.timeoutMs).toBe(customConfig.session.timeoutMs);
    expect(config.enable!.errorTracking).toBe(customConfig.enable.errorTracking);
    expect(config.enable!.frustrationDetection).toBe(customConfig.enable.frustrationDetection);
    expect(config.enable!.webVitals).toBe(customConfig.enable.webVitals);
    // expect(config.enable!.sessionReplay).toBe(customConfig.enable.sessionReplay);
    expect(config.samplingRate).toBe(customConfig.samplingRate);
    expect(config.customAttributes).toEqual(customConfig.customAttributes);
    expect(config.frustrationThresholds!.rageClickCount).toBe(DEFAULT_RAGE_CLICK_COUNT);
    expect(config.frustrationThresholds!.rageClickIntervalMs).toBe(DEFAULT_RAGE_CLICK_INTERVAL_MS);
    expect(config.frustrationThresholds!.heavyLoadThresholdMs).toBe(
      DEFAULT_HEAVY_LOAD_THRESHOLD_MS,
    );
  });

  it('should not require logs token if relevant features are disabled', () => {
    const config = new RUMConfig({
      region: 'us',
      tokens: { traces: 'trace-token' },
      endpoint: { url: 'https://example.com' },
      enable: { errorTracking: false, webVitals: false, viewEvents: false, consoleLogs: false },
    });
    expect(config.tokens.logs).toBe('');
    expect(config.enable!.errorTracking).toBe(false);
    expect(config.enable!.webVitals).toBe(false);
  });

  it('should allow frustration detection without logs token', () => {
    const config = new RUMConfig({
      region: 'us',
      tokens: { traces: 'trace-token' },
      endpoint: { url: 'https://example.com' },
      enable: {
        errorTracking: false,
        webVitals: false,
        viewEvents: false,
        consoleLogs: false,
        frustrationDetection: true,
      },
    });
    expect(config.tokens.logs).toBe('');
    expect(config.enable!.frustrationDetection).toBe(true);
  });

  it('should throw an error if required fields are missing', () => {
    expect(() => new RUMConfig({})).toThrow('Region is required in RUM configuration.');
    expect(() => new RUMConfig({ region: 'eu' })).toThrow(
      'Tokens are required in RUM configuration.',
    );
    expect(() => new RUMConfig({ region: 'eu', tokens: { logs: 'logs-token' } as any })).toThrow(
      'Traces token is required in RUM configuration.',
    );
    expect(() => new RUMConfig({ region: 'eu', tokens: { traces: 'trace-token' } })).toThrow(
      'Endpoint URL is required in RUM configuration.',
    );
    expect(
      () => new RUMConfig({ region: 'eu', tokens: { traces: 'trace-token' }, endpoint: {} as any }),
    ).toThrow('Endpoint URL is required in RUM configuration.');
  });

  it('should warn and disable logs token is missing and log-dependent features are enabled', () => {
    const { rumLogger } = require('@src/shared');

    const config = new RUMConfig({
      region: 'eu',
      tokens: { traces: 'trace-token' },
      endpoint: { url: 'https://example.com' },
    });

    expect(rumLogger.warn).toHaveBeenCalledWith(
      'Logs token is required in RUM configuration when error tracking, view events, console logs, or web vitals are enabled. These features will not be sent.',
    );
    expect(config.enable!.errorTracking).toBe(false);
    expect(config.enable!.viewEvents).toBe(false);
    expect(config.enable!.consoleLogs).toBe(false);
    expect(config.enable!.webVitals).toBe(false);
    // Frustration detection should still be enabled since it only uses traces
    expect(config.enable!.frustrationDetection).toBe(true);
  });

  it('should assign default values for out-of-range fields', () => {
    let config = new RUMConfig({
      region: 'us',
      tokens: { traces: 'trace-token' },
      endpoint: { url: 'https://example.com' },
      session: {
        maxDurationMs: -1,
        timeoutMs: -1000,
      },
      enable: {
        errorTracking: false,
        webVitals: false,
      },
      samplingRate: -1,
      frustrationThresholds: {
        rageClickCount: -1,
        rageClickIntervalMs: 0,
        heavyLoadThresholdMs: -3000,
      },
    });
    expect(config.samplingRate).toBe(DEFAULT_SAMPLE_RATE);
    expect(config.frustrationThresholds!.rageClickCount).toBe(DEFAULT_RAGE_CLICK_COUNT);
    expect(config.frustrationThresholds!.rageClickIntervalMs).toBe(DEFAULT_RAGE_CLICK_INTERVAL_MS);
    expect(config.frustrationThresholds!.heavyLoadThresholdMs).toBe(
      DEFAULT_HEAVY_LOAD_THRESHOLD_MS,
    );
    expect(config.session!.maxDurationMs).toBe(DEFAULT_SESSION_MAX_DURATION_MS);
    expect(config.session!.timeoutMs).toBe(DEFAULT_SESSION_TIMEOUT_MS);

    config = new RUMConfig({
      region: 'us',
      tokens: { traces: 'trace-token' },
      endpoint: { url: 'https://example.com' },
      samplingRate: 101,
      enable: {
        errorTracking: false,
        webVitals: false,
      },
    });
    expect(config.samplingRate).toBe(DEFAULT_SAMPLE_RATE);
  });

  describe('log level', () => {
    it('should choose the correct debug log level', () => {
      const debugConfig = new RUMConfig({
        region: 'us',
        tokens: { traces: 'trace-token' },
        endpoint: { url: 'https://example.com' },
        logLevel: 'debug',
      });
      expect(debugConfig.logLevel).toBe(LogLevel.DEBUG);
    });

    it('should choose the correct warn log level', () => {
      const warnConfig = new RUMConfig({
        region: 'us',
        tokens: { traces: 'trace-token' },
        endpoint: { url: 'https://example.com' },
        logLevel: 'warn',
      });
      expect(warnConfig.logLevel).toBe(LogLevel.WARN);
    });

    it('should choose the correct info log level', () => {
      const infoConfig = new RUMConfig({
        region: 'us',
        tokens: { traces: 'trace-token' },
        endpoint: { url: 'https://example.com' },
        logLevel: 'info',
      });
      expect(infoConfig.logLevel).toBe(LogLevel.INFO);
    });

    it('should choose the correct error log level', () => {
      const errorConfig = new RUMConfig({
        region: 'us',
        tokens: { traces: 'trace-token' },
        endpoint: { url: 'https://example.com' },
        logLevel: 'error',
      });
      expect(errorConfig.logLevel).toBe(LogLevel.ERROR);
    });

    it('should choose the correct off log level', () => {
      const offConfig = new RUMConfig({
        region: 'us',
        tokens: { traces: 'trace-token' },
        endpoint: { url: 'https://example.com' },
        logLevel: 'off',
      });
      expect(offConfig.logLevel).toBe(LogLevel.OFF);
    });

    it('should default to info log level', () => {
      const config = new RUMConfig({
        region: 'us',
        tokens: { traces: 'trace-token' },
        endpoint: { url: 'https://example.com' },
      });
      expect(config.logLevel).toBe(LogLevel.INFO);
    });

    it('should default to info log level if an invalid log level is provided', () => {
      const config = new RUMConfig({
        region: 'us',
        tokens: { traces: 'trace-token' },
        endpoint: { url: 'https://example.com' },
        logLevel: 'invalid',
      });
      expect(config.logLevel).toBe(LogLevel.INFO);
    });
  });

  describe('endpoint', () => {
    it('should throw an error when endpoint.url is missing', () => {
      expect(
        () =>
          new RUMConfig({
            region: 'eu',
            tokens: { traces: 'trace-token' },
          }),
      ).toThrow('Endpoint URL is required in RUM configuration.');
    });

    it('should throw an error when endpoint.url is empty', () => {
      expect(
        () =>
          new RUMConfig({
            region: 'eu',
            tokens: { traces: 'trace-token' },
            endpoint: { url: '' },
          }),
      ).toThrow('Endpoint URL is required in RUM configuration.');
    });

    it('should throw an error when endpoint.url is invalid', () => {
      expect(
        () =>
          new RUMConfig({
            region: 'eu',
            tokens: { traces: 'trace-token' },
            endpoint: { url: 'invalid-url' },
          }),
      ).toThrow('Invalid Endpoint URL "invalid-url".');
    });

    it('should normalize endpoint url by trimming whitespace', () => {
      const config = new RUMConfig({
        region: 'eu',
        tokens: { traces: 'trace-token' },
        endpoint: { url: '  https://custom.endpoint.com  ' },
      });
      expect(config.endpoint.url).toBe('https://custom.endpoint.com');
      expect(config.endpoint.addSuffix).toBe(false);
    });

    it('should respect addSuffix setting when provided', () => {
      const config = new RUMConfig({
        region: 'eu',
        tokens: { traces: 'trace-token' },
        endpoint: { url: 'https://custom.endpoint.com', addSuffix: false },
      });
      expect(config.endpoint.url).toBe('https://custom.endpoint.com');
      expect(config.endpoint.addSuffix).toBe(false);
    });

    it('should default addSuffix to false when not provided', () => {
      const config = new RUMConfig({
        region: 'eu',
        tokens: { traces: 'trace-token' },
        endpoint: { url: 'https://custom.endpoint.com' },
      });
      expect(config.endpoint.url).toBe('https://custom.endpoint.com');
      expect(config.endpoint.addSuffix).toBe(false);
    });

    it('should accept valid endpoint URLs', () => {
      const endpoints = [
        'https://example.com',
        'https://example.com/',
        'http://localhost:3000',
        'https://custom.endpoint.com/api/v1',
      ];

      endpoints.forEach((url) => {
        expect(
          () =>
            new RUMConfig({
              region: 'eu',
              tokens: { traces: 'trace-token' },
              endpoint: { url },
            }),
        ).not.toThrow();
      });
    });
  });
});
