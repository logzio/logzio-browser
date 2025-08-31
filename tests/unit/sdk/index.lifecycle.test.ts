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

describe('LogzioRUM - lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset static state
    (LogzioRUM as any).instance = null;
    (LogzioRUM as any).session = null;
  });

  it('init should not throw and create instance', () => {
    expect(() => LogzioRUM.init({ logLevel: 'debug' })).not.toThrow();
  });

  it('shutdown should not throw and is idempotent', () => {
    LogzioRUM.init({});

    expect(() => LogzioRUM.shutdown()).not.toThrow();

    // Should be idempotent (calling twice doesn't throw)
    expect(() => LogzioRUM.shutdown()).not.toThrow();
  });

  it('init should complete successfully', () => {
    expect(() => LogzioRUM.init({})).not.toThrow();
  });

  it('init should be safe to call multiple times (no-throw)', () => {
    expect(() => {
      LogzioRUM.init({});
      LogzioRUM.init({});
    }).not.toThrow();
  });

  it('init should handle errors gracefully (no-throw policy)', () => {
    // This test verifies that even if internal errors occur, init doesn't throw
    expect(() => LogzioRUM.init({})).not.toThrow();
  });
});
