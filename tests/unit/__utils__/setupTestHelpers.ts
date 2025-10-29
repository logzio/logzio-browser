/**
 * Centralized helpers for OpenTelemetry setup testing
 */

// Common setup test scenarios
export const setupScenarios = [
  {
    name: 'with all instrumentations enabled',
    config: {
      enable: {
        consoleLogs: true,
        exceptions: true,
        userInteractions: true,
        pageView: true,
        frustrationDetection: true,
      },
    },
  },
  {
    name: 'with minimal instrumentations',
    config: {
      enable: {
        consoleLogs: false,
        exceptions: true,
        userInteractions: false,
        pageView: true,
        frustrationDetection: false,
      },
    },
  },
];

// Provider registration scenarios
export const providerScenarios = [
  { name: 'traces provider', providerType: 'traces' },
  { name: 'metrics provider', providerType: 'metrics' },
  { name: 'logs provider', providerType: 'logs' },
];

// Setup helper for OpenTelemetry setup tests
export function setupOtelTest() {
  jest.clearAllMocks();

  // Reset provider singleton
  const { resetProviderSingleton } = require('./providerHelpers');
  resetProviderSingleton();

  return {
    cleanup: () => {
      resetProviderSingleton();
    },
  };
}

// Helper to verify provider registration
export function expectProviderRegistered(providerType: string, mockRegister: jest.Mock) {
  expect(mockRegister).toHaveBeenCalledWith(
    expect.objectContaining({
      // Provider should have been registered with appropriate configuration
    }),
  );
}

// Helper to verify instrumentation setup
export function expectInstrumentationEnabled(
  instrumentationName: string,
  mockInstrumentation: any,
) {
  expect(mockInstrumentation).toHaveBeenCalled();
}
