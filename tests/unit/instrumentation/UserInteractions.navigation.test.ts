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

  it('should demonstrate span name update logic with formatted URL', () => {
    const mockSpan = {
      updateName: jest.fn(),
    };

    // Simulate navigation handling with formatted URL
    const navigationEvent = {
      oldUrl: 'https://example.com/page1',
      newUrl: 'https://example.com/page2?param=value#section',
    };

    // Test URL formatting logic
    const formatUrlForNavigation = (fullUrl: string): string => {
      try {
        const url = new URL(fullUrl);
        return `${url.pathname}${url.hash}${url.search}`;
      } catch (error) {
        return fullUrl;
      }
    };

    expect(() => {
      if (logic.shouldUpdateSpanName(navigationEvent.oldUrl, navigationEvent.newUrl, true)) {
        const formattedUrl = formatUrlForNavigation(navigationEvent.newUrl);
        mockSpan.updateName(`Navigation: ${formattedUrl}`);
      }
    }).not.toThrow();

    expect(mockSpan.updateName).toHaveBeenCalledWith('Navigation: /page2#section?param=value');
  });

  it('should handle URL formatting edge cases', () => {
    const formatUrlForNavigation = (fullUrl: string): string => {
      try {
        const url = new URL(fullUrl);
        return `${url.pathname}${url.hash}${url.search}`;
      } catch (error) {
        return fullUrl;
      }
    };

    // Test various URL formats
    expect(formatUrlForNavigation('https://example.com/path')).toBe('/path');
    expect(formatUrlForNavigation('https://example.com/path?query=1')).toBe('/path?query=1');
    expect(formatUrlForNavigation('https://example.com/path#hash')).toBe('/path#hash');
    expect(formatUrlForNavigation('https://example.com/path?query=1#hash')).toBe(
      '/path#hash?query=1',
    );

    // Test invalid URL fallback
    expect(formatUrlForNavigation('invalid-url')).toBe('invalid-url');
  });
});
