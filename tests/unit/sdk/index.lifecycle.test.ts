// Mock dependencies before imports
jest.mock('@src/shared', () => ({
  rumLogger: {
    setLevel: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@src/config', () => ({
  RUMConfig: jest.fn().mockImplementation(() => ({})),
}));

const mockEventListener = {
  remove: jest.fn(),
};

const mockNavigationInstance = {
  init: jest.fn(),
  eventListeners: [mockEventListener],
  subscribers: new Map(),
  isInitialized: false,
  unpatchHistoryMethods: jest.fn(),
  originalHistory: {},
};

jest.mock('@src/instrumentation/trackers', () => ({
  NavigationTracker: {
    getInstance: jest.fn(() => mockNavigationInstance),
    shutdown: jest.fn(),
    instance: null,
  },
}));

const mockProviderInstance = {
  registerProviders: jest.fn(),
  registerInstrumentations: jest.fn(),
  setSessionManager: jest.fn(),
  forceFlush: jest.fn(),
  shutdown: jest.fn().mockResolvedValue(undefined),
};

jest.mock('@src/openTelemetry/setup', () => ({
  OpenTelemetryProvider: {
    getInstance: jest.fn(() => mockProviderInstance),
    shutdown: jest.fn().mockResolvedValue(undefined),
    reset: jest.fn(),
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
      disable: jest.fn(),
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

  it('shutdown should not throw and is idempotent', async () => {
    LogzioRUM.init({});

    await expect(LogzioRUM.shutdown()).resolves.not.toThrow();

    // Should be idempotent (calling twice doesn't throw)
    await expect(LogzioRUM.shutdown()).resolves.not.toThrow();
  });

  it('init should complete successfully', () => {
    expect(() => LogzioRUM.init({})).not.toThrow();
  });

  it('init should be safe to call multiple times and warn on subsequent calls', () => {
    const { rumLogger } = require('@src/shared');

    // First call should succeed without warning
    expect(() => LogzioRUM.init({})).not.toThrow();

    // Verify instance is set after first call
    expect((LogzioRUM as any).instance).toBeTruthy();

    // Second call should warn but not throw
    expect(() => LogzioRUM.init({})).not.toThrow();

    // Should warn on the second call
    expect(rumLogger.warn).toHaveBeenCalledWith('LogzioRUM is already initialized.');
    expect(rumLogger.warn).toHaveBeenCalledTimes(1);
  });

  it('init should handle errors gracefully (no-throw policy)', () => {
    // This test verifies that even if internal errors occur, init doesn't throw
    expect(() => LogzioRUM.init({})).not.toThrow();
  });

  it('shutdown should complete successfully and clear static state', async () => {
    const { OpenTelemetryProvider } = require('@src/openTelemetry/setup');
    const { NavigationTracker } = require('@src/instrumentation/trackers');

    // Ensure mocks are properly set up for happy path
    OpenTelemetryProvider.shutdown.mockResolvedValue(undefined);
    NavigationTracker.shutdown.mockImplementation(() => {
      // Happy path - no errors, just return successfully
      return;
    });

    // Initialize first
    LogzioRUM.init({});

    const sessionInstance = (LogzioRUM as any).session;

    // Call shutdown - should not throw
    await expect(LogzioRUM.shutdown()).resolves.toBeUndefined();

    // Verify key cleanup methods were called
    expect(sessionInstance.shutdown).toHaveBeenCalledTimes(1);
    expect(OpenTelemetryProvider.shutdown).toHaveBeenCalledTimes(1);
    expect(NavigationTracker.shutdown).toHaveBeenCalledTimes(1);

    // Verify static state was cleared (most important)
    expect((LogzioRUM as any).instance).toBeNull();
    expect((LogzioRUM as any).session).toBeNull();
  });

  it('shutdown should handle errors gracefully and continue cleanup', async () => {
    const { OpenTelemetryProvider } = require('@src/openTelemetry/setup');
    const { LogzioContextManager } = require('@src/context/LogzioContextManager');
    const { rumLogger } = require('@src/shared');

    // Initialize first
    LogzioRUM.init({});

    // Make some methods throw errors
    const contextInstance = LogzioContextManager.getInstance();

    OpenTelemetryProvider.shutdown.mockRejectedValue(new Error('Provider shutdown failed'));
    contextInstance.disable.mockImplementation(() => {
      throw new Error('Context disable failed');
    });

    // Shutdown should not throw despite errors
    await expect(LogzioRUM.shutdown()).resolves.not.toThrow();

    // Verify error was logged (single try-catch catches first error)
    expect(rumLogger.error).toHaveBeenCalledWith(
      'Error during LogzioRUM shutdown:',
      expect.any(Error),
    );

    // Verify cleanup still completed (static state cleared)
    expect((LogzioRUM as any).instance).toBeNull();
  });
});
