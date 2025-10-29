import { LogzioRUM } from '../../../src';
import { createConfig } from '../../unit/__utils__/configFactory';
import { resetProviderSingleton } from '../../unit/__utils__/providerHelpers';

/**
 * Simplified JSDOM integration tests that avoid OTLP exporter issues
 * by testing RUM initialization and behavior without actual network exports
 */
describe('RUM Simple Integration (JSDOM)', () => {
  const DISABLE_METRICS_FEATURES = {
    webVitals: false,
    viewEvents: false,
    frustrationDetection: false,
  } as const;
  beforeEach(() => {
    resetProviderSingleton();
    // Clear any previous RUM state
    try {
      LogzioRUM.shutdown();
    } catch (_error) {
      // Ignore shutdown errors
    }
  });

  afterEach(() => {
    try {
      LogzioRUM.shutdown();
    } catch (_error) {
      // Ignore shutdown errors
    }
    resetProviderSingleton();
  });

  it('should initialize RUM library without throwing', () => {
    const config = createConfig({
      tokens: { traces: 'test-token' },
      enable: {
        ...DISABLE_METRICS_FEATURES,
        userActions: true,
        documentLoad: true,
        navigation: true,
      },
    });

    expect(() => {
      LogzioRUM.init(config);
    }).not.toThrow();
  });

  it('should handle multiple initializations gracefully', () => {
    const config = createConfig({
      tokens: { traces: 'test-token' },
      enable: { ...DISABLE_METRICS_FEATURES },
    });

    expect(() => {
      LogzioRUM.init(config);
      LogzioRUM.init(config); // Second init should not throw
    }).not.toThrow();
  });

  it('should handle shutdown gracefully', () => {
    const config = createConfig({
      tokens: { traces: 'test-token' },
      enable: { ...DISABLE_METRICS_FEATURES },
    });

    LogzioRUM.init(config);

    expect(() => {
      LogzioRUM.shutdown();
      LogzioRUM.shutdown(); // Second shutdown should not throw
    }).not.toThrow();
  });

  it('should handle invalid configuration gracefully', () => {
    expect(() => {
      LogzioRUM.init({ enable: { ...DISABLE_METRICS_FEATURES } } as any);
    }).not.toThrow(); // Should use defaults, not throw
  });

  it('should handle console instrumentation', () => {
    const config = createConfig({
      tokens: { traces: 'test-token', logs: 'test-token' },
      enable: { ...DISABLE_METRICS_FEATURES, consoleLogs: true },
    });

    LogzioRUM.init(config);

    // These should not throw
    expect(() => {
      console.log('Test message');
      console.warn('Test warning');
      console.error('Test error');
    }).not.toThrow();
  });

  it('should handle user interactions', () => {
    const config = createConfig({
      tokens: { traces: 'test-token' },
      enable: { ...DISABLE_METRICS_FEATURES, userActions: true },
    });

    LogzioRUM.init(config);

    // Create a button and simulate click
    const button = document.createElement('button');
    document.body.appendChild(button);

    expect(() => {
      button.click();
    }).not.toThrow();

    document.body.removeChild(button);
  });

  it('should handle navigation events', () => {
    const config = createConfig({
      tokens: { traces: 'test-token' },
      enable: { ...DISABLE_METRICS_FEATURES, navigation: true },
    });

    LogzioRUM.init(config);

    expect(() => {
      // Simulate navigation
      const event = new PopStateEvent('popstate');
      window.dispatchEvent(event);
    }).not.toThrow();
  });

  it('should handle errors gracefully', () => {
    const config = createConfig({
      tokens: { traces: 'test-token', logs: 'test-token' },
      enable: { ...DISABLE_METRICS_FEATURES, errorTracking: true },
    });

    LogzioRUM.init(config);

    expect(() => {
      // Simulate error
      const error = new Error('Test error');
      const event = new ErrorEvent('error', { error });
      window.dispatchEvent(event);
    }).not.toThrow();
  });
});
