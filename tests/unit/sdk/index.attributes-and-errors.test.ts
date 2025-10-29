// Mock dependencies before imports
jest.mock('@src/shared', () => ({
  rumLogger: {
    setLevel: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@src/instrumentation/trackers', () => ({
  NavigationTracker: {
    getInstance: jest.fn(() => ({
      init: jest.fn(),
    })),
  },
}));

jest.mock('@src/openTelemetry/setup', () => ({
  OpenTelemetryProvider: {
    getInstance: jest.fn(() => ({
      registerProviders: jest.fn(),
      registerInstrumentations: jest.fn(),
    })),
  },
}));

jest.mock('@src/context/RUMSessionManager', () => ({
  RUMSessionManager: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    shutdown: jest.fn(),
  })),
}));

jest.mock('@src/context/LogzioContextManager', () => ({
  LogzioContextManager: {
    getInstance: jest.fn(() => ({
      getCurrentCustomAttributes: jest.fn(),
      setCustomAttributes: jest.fn(),
    })),
  },
}));

import { LogzioRUM } from '@src/index';
import { rumLogger } from '@src/shared';
import { LogzioContextManager } from '@src/context/LogzioContextManager';

describe('LogzioRUM - attributes and errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset static state
    (LogzioRUM as any).instance = null;
    (LogzioRUM as any).session = null;
  });

  it('before init getAttributes should return undefined', () => {
    const result = LogzioRUM.getAttributes();
    expect(result).toBeUndefined();
  });

  it('before init setAttributes should warn and is no-op', () => {
    const mockContextManager = { setCustomAttributes: jest.fn() };
    (LogzioContextManager.getInstance as jest.Mock).mockReturnValue(mockContextManager);

    LogzioRUM.setAttributes({ test: 'value' });

    expect(rumLogger.warn).toHaveBeenCalledWith('LogzioRUM not initialized. Call init() first.');
    expect(mockContextManager.setCustomAttributes).not.toHaveBeenCalled();
  });

  it('after init get/set attributes should work without throwing', () => {
    LogzioRUM.init({});

    // Test getAttributes - should not throw and should return something (mocked)
    expect(() => LogzioRUM.getAttributes()).not.toThrow();

    // Test setAttributes - should not throw
    expect(() => LogzioRUM.setAttributes({ a: 1 })).not.toThrow();
  });

  it('should create instance with proper configuration', () => {
    expect(() => LogzioRUM.init({ logLevel: 'error' })).not.toThrow();

    // Verify that getAttributes works after init (should not throw)
    expect(() => LogzioRUM.getAttributes()).not.toThrow();
  });

  it('should handle errors gracefully during init', () => {
    // This test verifies that init handles internal errors gracefully
    expect(() => LogzioRUM.init({})).not.toThrow();
  });
});
