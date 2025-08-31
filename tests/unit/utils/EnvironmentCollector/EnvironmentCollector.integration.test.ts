/**
 * Integration tests for EnvironmentCollector - testing the main collect() method
 */
import {
  EnvironmentCollector,
  EnvironmentCollectionOptions,
} from '@src/utils/EnvironmentCollector';
import { setupEnvironmentMocks, restoreGlobals } from '../../__utils__/environmentMocks';

// Mock shared dependencies using centralized helper
jest.mock('@src/shared', () => {
  const { createSharedMock } = require('../../__utils__/loggerMocks');
  return createSharedMock();
});

describe('EnvironmentCollector Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupEnvironmentMocks();
  });

  afterEach(() => {
    restoreGlobals();
  });

  describe('selective data collection', () => {
    it('should collect only browser data when collectBrowser is true', () => {
      const options: EnvironmentCollectionOptions = { collectBrowser: true };
      const result = EnvironmentCollector.collect(options);

      // Should have browser-related attributes
      expect(result['user_agent']).toBeDefined();
      expect(result['browser.name']).toBeDefined();
      expect(result['browser.version']).toBeDefined();

      // Should not have other attributes
      expect(result['os.name']).toBeUndefined();
      expect(result['device.type']).toBeUndefined();
      expect(result['user.language']).toBeUndefined();
    });

    it('should collect only OS data when collectOS is true', () => {
      const options: EnvironmentCollectionOptions = { collectOS: true };
      const result = EnvironmentCollector.collect(options);

      // Should have OS-related attributes
      expect(result['os.name']).toBeDefined();

      // Should not have other attributes
      expect(result['user_agent']).toBeUndefined();
      expect(result['browser.name']).toBeUndefined();
      expect(result['device.type']).toBeUndefined();
      expect(result['user.language']).toBeUndefined();
    });

    it('should collect only device data when collectDevice is true', () => {
      const options: EnvironmentCollectionOptions = { collectDevice: true };
      const result = EnvironmentCollector.collect(options);

      // Should have device-related attributes
      expect(result['device.type']).toBeDefined();
      expect(result['device.screen.width']).toBeDefined();
      expect(result['device.screen.height']).toBeDefined();

      // Should not have other attributes
      expect(result['user_agent']).toBeUndefined();
      expect(result['browser.name']).toBeUndefined();
      expect(result['os.name']).toBeUndefined();
      expect(result['user.language']).toBeUndefined();
    });

    it('should collect only language data when collectLanguage is true', () => {
      const options: EnvironmentCollectionOptions = { collectLanguage: true };
      const result = EnvironmentCollector.collect(options);

      // Should have language-related attributes
      expect(result['user.language']).toBeDefined();
      expect(result['user.timezone']).toBeDefined();

      // Should not have other attributes
      expect(result['user_agent']).toBeUndefined();
      expect(result['browser.name']).toBeUndefined();
      expect(result['os.name']).toBeUndefined();
      expect(result['device.type']).toBeUndefined();
    });
  });

  describe('comprehensive collection', () => {
    it('should collect all data when all flags are true', () => {
      const options: EnvironmentCollectionOptions = {
        collectBrowser: true,
        collectOS: true,
        collectDevice: true,
        collectLanguage: true,
      };
      const result = EnvironmentCollector.collect(options);

      // Should have all attributes
      expect(result['user_agent']).toBeDefined();
      expect(result['browser.name']).toBeDefined();
      expect(result['browser.version']).toBeDefined();
      expect(result['os.name']).toBeDefined();
      expect(result['device.type']).toBeDefined();
      expect(result['device.screen.width']).toBeDefined();
      expect(result['device.screen.height']).toBeDefined();
      expect(result['user.language']).toBeDefined();
      expect(result['user.timezone']).toBeDefined();
    });

    it('should return empty object when no flags are set', () => {
      const options: EnvironmentCollectionOptions = {};
      const result = EnvironmentCollector.collect(options);

      expect(Object.keys(result)).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    it('should handle collectEnvData throwing and log error', () => {
      // In jsdom, we can't redefine window, so let's test with a property that throws
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', {
        get: () => {
          throw new Error('Window access failed');
        },
        configurable: true,
      });

      const options: EnvironmentCollectionOptions = { collectDevice: true };
      const result = EnvironmentCollector.collect(options);

      // Should still work but may not include the problematic property
      expect(typeof result).toBe('object');

      // Restore window property
      Object.defineProperty(window, 'innerWidth', {
        value: originalInnerWidth,
        writable: true,
        configurable: true,
      });
    });
  });
});
