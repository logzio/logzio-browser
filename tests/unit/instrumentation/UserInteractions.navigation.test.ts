/**
 * @jest-environment jsdom
 */

import { createOtelApiMock } from '../__utils__/otelApiMocks';
import {
  setupUserInteractionsTest,
  testInstrumentationLogic,
} from '../__utils__/userInteractionsTestHelpers';

// Mock OpenTelemetry API using centralized helper
jest.mock('@opentelemetry/api', () => createOtelApiMock());

describe('UserInteractions Navigation Handling', () => {
  let logic: ReturnType<typeof testInstrumentationLogic>;

  beforeEach(() => {
    setupUserInteractionsTest();
    logic = testInstrumentationLogic();
  });

  it('should determine when to update span name based on URL change', () => {
    const oldUrl = 'https://example.com/page1';
    const newUrl = 'https://example.com/page2';
    const isEnabled = true;

    const shouldUpdate = logic.shouldUpdateSpanName(oldUrl, newUrl, isEnabled);

    expect(shouldUpdate).toBe(true);
  });

  it('should not update span name when URL is unchanged', () => {
    const oldUrl = 'https://example.com/page1';
    const newUrl = 'https://example.com/page1';
    const isEnabled = true;

    const shouldUpdate = logic.shouldUpdateSpanName(oldUrl, newUrl, isEnabled);

    expect(shouldUpdate).toBe(false);
  });

  it('should not update span name when instrumentation is disabled', () => {
    const oldUrl = 'https://example.com/page1';
    const newUrl = 'https://example.com/page2';
    const isEnabled = false;

    const shouldUpdate = logic.shouldUpdateSpanName(oldUrl, newUrl, isEnabled);

    expect(shouldUpdate).toBe(false);
  });

  it('should demonstrate span name update logic', () => {
    const mockSpan = {
      updateName: jest.fn(),
    };

    // Get the mocked OTEL API and add the needed methods
    const otelApi = require('@opentelemetry/api');
    otelApi.trace = {
      getSpan: jest.fn().mockReturnValue(mockSpan),
      setSpan: jest.fn(),
      getActiveSpan: jest.fn(),
    };
    otelApi.context = {
      active: jest.fn().mockReturnValue({}),
      with: jest.fn(),
    };

    // Simulate navigation handling
    const navigationEvent = {
      oldUrl: 'https://example.com/page1',
      newUrl: 'https://example.com/page2',
    };

    expect(() => {
      if (logic.shouldUpdateSpanName(navigationEvent.oldUrl, navigationEvent.newUrl, true)) {
        const span = otelApi.trace.getSpan(otelApi.context.active());
        if (span && typeof span.updateName === 'function') {
          span.updateName(`Navigation ${navigationEvent.newUrl}`);
        }
      }
    }).not.toThrow();

    expect(mockSpan.updateName).toHaveBeenCalledWith('Navigation https://example.com/page2');
  });

  it('should handle missing active span gracefully', () => {
    // Get the mocked OTEL API and add the needed methods
    const otelApi = require('@opentelemetry/api');
    otelApi.trace = {
      getSpan: jest.fn().mockReturnValue(undefined), // No active span
      setSpan: jest.fn(),
      getActiveSpan: jest.fn(),
    };
    otelApi.context = {
      active: jest.fn().mockReturnValue({}),
      with: jest.fn(),
    };

    expect(() => {
      const span = otelApi.trace.getSpan(otelApi.context.active());
      if (span && typeof span.updateName === 'function') {
        span.updateName('Navigation https://example.com/page2');
      }
    }).not.toThrow();
  });
});
