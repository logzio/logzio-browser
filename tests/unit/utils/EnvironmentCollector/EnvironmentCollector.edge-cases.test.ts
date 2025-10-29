/**
 * Edge cases and robustness tests for EnvironmentCollector
 */
import {
  EnvironmentCollector,
  EnvironmentCollectionOptions,
} from '@src/utils/EnvironmentCollector';
import {
  restoreGlobals,
  mockNavigator,
  mockWindowAndScreen,
} from '../../__utils__/environmentMocks';

// Mock shared dependencies using centralized helper
jest.mock('@src/shared', () => {
  const { createSharedMock } = require('../../__utils__/loggerMocks');
  return createSharedMock();
});

describe('EnvironmentCollector Edge Cases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    restoreGlobals();
  });

  describe('missing globals handling', () => {
    it('should handle missing navigator gracefully', () => {
      // In jsdom, we need to mock navigator differently
      const originalNavigator = global.navigator;
      delete (global as any).navigator;
      mockWindowAndScreen({});

      const options: EnvironmentCollectionOptions = { collectBrowser: true };

      // Should not throw - implementation handles missing navigator with ?. operator
      expect(() => EnvironmentCollector.collect(options)).not.toThrow();

      const result = EnvironmentCollector.collect(options);
      // With undefined navigator, userAgent will be empty string, so no attributes added
      expect(Object.keys(result)).toHaveLength(0);

      // Restore navigator
      global.navigator = originalNavigator;
    });

    it('should handle missing window gracefully', () => {
      mockNavigator({ userAgent: 'test' });

      // In jsdom, we can't remove window, so test with missing window properties
      const originalInnerWidth = window.innerWidth;
      const originalInnerHeight = window.innerHeight;

      delete (window as any).innerWidth;
      delete (window as any).innerHeight;

      const options: EnvironmentCollectionOptions = { collectDevice: true };

      // Should not throw
      expect(() => EnvironmentCollector.collect(options)).not.toThrow();

      // Restore window properties
      (window as any).innerWidth = originalInnerWidth;
      (window as any).innerHeight = originalInnerHeight;
    });

    it('should handle missing screen gracefully', () => {
      mockNavigator({ userAgent: 'test' });
      mockWindowAndScreen({ width: 1920, height: 1080 });

      // Remove screen property in jsdom
      const originalScreen = window.screen;
      delete (window as any).screen;

      const options: EnvironmentCollectionOptions = { collectDevice: true };

      // Should not throw
      expect(() => EnvironmentCollector.collect(options)).not.toThrow();

      // Restore screen
      (window as any).screen = originalScreen;
    });

    it('should handle missing Intl gracefully', () => {
      mockNavigator({ userAgent: 'test', language: 'en-US' });

      // Remove Intl in jsdom
      const originalIntl = global.Intl;
      delete (global as any).Intl;

      const options: EnvironmentCollectionOptions = { collectLanguage: true };

      // Should not throw
      expect(() => EnvironmentCollector.collect(options)).not.toThrow();

      // Restore Intl
      global.Intl = originalIntl;
    });
  });

  describe('branch coverage scenarios', () => {
    it('should handle undefined navigator language', () => {
      mockNavigator({ userAgent: 'test', language: undefined });

      // Remove Intl to ensure timezone is also undefined
      const originalIntl = global.Intl;
      delete (global as any).Intl;

      const options: EnvironmentCollectionOptions = { collectLanguage: true };
      const result = EnvironmentCollector.collect(options);

      expect(result['user.language']).toBeUndefined();
      // Timezone should also be undefined when Intl is missing
      expect(result['user.timezone']).toBeUndefined();

      // Restore Intl
      global.Intl = originalIntl;
    });

    it('should handle falsy values in user agent detection', () => {
      const falsy = [null, undefined, '', 0, false];

      falsy.forEach((value) => {
        mockNavigator({ userAgent: String(value) });
        mockWindowAndScreen({});

        const options: EnvironmentCollectionOptions = { collectBrowser: true };
        const result = EnvironmentCollector.collect(options);

        // Should not crash and should return empty or default values
        expect(typeof result).toBe('object');
      });
    });

    it('should handle various invalid screen dimensions', () => {
      mockNavigator({ userAgent: 'test' });

      // Test with negative values using jsdom-compatible approach
      mockWindowAndScreen({ width: -100, height: -200 });

      const options: EnvironmentCollectionOptions = { collectDevice: true };

      expect(() => EnvironmentCollector.collect(options)).not.toThrow();
    });

    it('should handle malformed userAgentData', () => {
      mockNavigator({
        userAgent: 'test',
        userAgentData: null as any,
      });
      mockWindowAndScreen({});

      const options: EnvironmentCollectionOptions = { collectDevice: true };

      expect(() => EnvironmentCollector.collect(options)).not.toThrow();
    });
  });
});
