/**
 * Device detection tests for EnvironmentCollector
 */
import {
  EnvironmentCollector,
  EnvironmentCollectionOptions,
} from '@src/utils/EnvironmentCollector';
import { DeviceType } from '@src/instrumentation/semconv';
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

describe('EnvironmentCollector Device Detection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    restoreGlobals();
  });

  describe('device type detection', () => {
    it('should use userAgentData mobile flag when available', () => {
      // Mobile flag set to true should override screen size
      mockNavigator({
        userAgent: 'test',
        userAgentData: {
          brands: [{ brand: 'Chrome', version: '91' }],
          mobile: true,
          platform: 'Android',
        },
      });
      mockWindowAndScreen({ width: 1920, height: 1080 }); // Desktop size

      const options: EnvironmentCollectionOptions = { collectDevice: true };
      const result = EnvironmentCollector.collect(options);

      expect(result['device.type']).toBe(DeviceType.MOBILE);
    });

    it('should fall back to screen size when userAgentData mobile is false', () => {
      mockNavigator({
        userAgent: 'test',
        userAgentData: {
          brands: [{ brand: 'Chrome', version: '91' }],
          mobile: false,
          platform: 'Windows',
        },
      });
      mockWindowAndScreen({
        width: 375,
        height: 667,
      }); // Mobile size

      const options: EnvironmentCollectionOptions = { collectDevice: true };
      const result = EnvironmentCollector.collect(options);

      expect(result['device.type']).toBe(DeviceType.MOBILE);
    });

    it('should detect mobile from user agent strings', () => {
      const mobileUAStrings = [
        'Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 Mobile Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) Mobile Safari/604.1',
      ];

      mobileUAStrings.forEach((ua) => {
        mockNavigator({ userAgent: ua });
        mockWindowAndScreen({ width: 1920, height: 1080 }); // Desktop size

        const options: EnvironmentCollectionOptions = { collectDevice: true };
        const result = EnvironmentCollector.collect(options);

        expect(result['device.type']).toBe(DeviceType.MOBILE);
      });
    });

    it('should detect desktop from screen size', () => {
      mockNavigator({ userAgent: 'test' });
      mockWindowAndScreen({ width: 1920, height: 1080 });

      const options: EnvironmentCollectionOptions = { collectDevice: true };
      const result = EnvironmentCollector.collect(options);

      expect(result['device.type']).toBe(DeviceType.DESKTOP);
    });

    it('should include screen dimensions', () => {
      mockNavigator({ userAgent: 'test' });
      mockWindowAndScreen({ width: 1920, height: 1080 });

      const options: EnvironmentCollectionOptions = { collectDevice: true };
      const result = EnvironmentCollector.collect(options);

      expect(result['device.screen.width']).toBe(1920);
      expect(result['device.screen.height']).toBe(1080);
    });
  });
});
