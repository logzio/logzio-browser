/**
 * Jest setup file executed before each test
 * This file should be minimal: no reusable helpers or global module mocks here.
 */

// Mock MetricsProviderManager to avoid timer.unref issues in Jest
jest.mock('../src/openTelemetry/MetricsProviderManager', () => {
  const { mockMetricsProviderManager } = require('./unit/__utils__/metricsProviderManagerMock');
  return {
    metricsProviderManager: mockMetricsProviderManager,
    MetricsProviderManager: jest.fn().mockImplementation(() => mockMetricsProviderManager),
  };
});

// Clean slate for every test
beforeEach(() => {
  jest.clearAllMocks();
});
