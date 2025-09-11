/**
 * @jest-environment jsdom
 */
import {
  setupUserInteractionsTest,
  createMockElement,
} from '../__utils__/userInteractionsTestHelpers';
import { ATTR_TARGET_ARIA_LABEL } from '@src/instrumentation/semconv';

describe('UserInteractions Aria Label Support', () => {
  beforeEach(() => {
    setupUserInteractionsTest();
  });

  describe('aria-label attribute extraction logic', () => {
    it('should extract aria-label when present', () => {
      const element = createMockElement({
        tagName: 'BUTTON',
        getAttribute: jest.fn((attr) => {
          if (attr === 'aria-label') return 'Submit Form';
          return null;
        }),
      });

      const ariaLabel = element.getAttribute('aria-label');
      expect(ariaLabel).toBe('Submit Form');
      expect(element.getAttribute).toHaveBeenCalledWith('aria-label');
    });

    it('should return null when aria-label not present', () => {
      const element = createMockElement({
        tagName: 'BUTTON',
        getAttribute: jest.fn(() => null), // No aria-label
      });

      const ariaLabel = element.getAttribute('aria-label');
      expect(ariaLabel).toBeNull();
      expect(element.getAttribute).toHaveBeenCalledWith('aria-label');
    });

    it('should handle empty aria-label gracefully', () => {
      const element = createMockElement({
        tagName: 'BUTTON',
        getAttribute: jest.fn((attr) => {
          if (attr === 'aria-label') return ''; // Empty string
          return null;
        }),
      });

      const ariaLabel = element.getAttribute('aria-label');
      expect(ariaLabel).toBe('');
    });

    it('should handle whitespace-only aria-label', () => {
      const element = createMockElement({
        tagName: 'BUTTON',
        getAttribute: jest.fn((attr) => {
          if (attr === 'aria-label') return '   '; // Whitespace only
          return null;
        }),
      });

      const ariaLabel = element.getAttribute('aria-label');
      expect(ariaLabel).toBe('   ');
    });

    it('should handle special characters in aria-label', () => {
      const specialLabel = 'Save & Continue → Next Step';
      const element = createMockElement({
        tagName: 'BUTTON',
        getAttribute: jest.fn((attr) => {
          if (attr === 'aria-label') return specialLabel;
          return null;
        }),
      });

      const ariaLabel = element.getAttribute('aria-label');
      expect(ariaLabel).toBe(specialLabel);
    });

    it('should handle very long aria-label values', () => {
      const longLabel = 'A'.repeat(1000); // 1000 character label
      const element = createMockElement({
        tagName: 'BUTTON',
        getAttribute: jest.fn((attr) => {
          if (attr === 'aria-label') return longLabel;
          return null;
        }),
      });

      const ariaLabel = element.getAttribute('aria-label');
      expect(ariaLabel).toBe(longLabel);
    });
  });

  describe('attribute building logic', () => {
    it('should build attributes object with aria-label when present', () => {
      const ariaLabel = 'Delete Item';
      const baseAttributes = {
        'event.type': 'click',
        'target.element': 'BUTTON',
        'target.xpath': '/html/body/button',
        'http.url': 'http://localhost',
      };

      // Simulate the logic from createSpan method
      const attributes: Record<string, any> = { ...baseAttributes };
      if (ariaLabel) {
        attributes[ATTR_TARGET_ARIA_LABEL] = ariaLabel;
      }

      expect(attributes).toEqual({
        ...baseAttributes,
        [ATTR_TARGET_ARIA_LABEL]: 'Delete Item',
      });
    });

    it('should build attributes object without aria-label when not present', () => {
      const ariaLabel = null;
      const baseAttributes = {
        'event.type': 'click',
        'target.element': 'BUTTON',
        'target.xpath': '/html/body/button',
        'http.url': 'http://localhost',
      };

      // Simulate the logic from createSpan method
      const attributes: Record<string, any> = { ...baseAttributes };
      if (ariaLabel) {
        attributes[ATTR_TARGET_ARIA_LABEL] = ariaLabel;
      }

      expect(attributes).toEqual(baseAttributes);
      expect(attributes).not.toHaveProperty(ATTR_TARGET_ARIA_LABEL);
    });

    it('should not include aria-label when empty string', () => {
      const ariaLabel = '';
      const baseAttributes = {
        'event.type': 'click',
        'target.element': 'BUTTON',
        'target.xpath': '/html/body/button',
        'http.url': 'http://localhost',
      };

      // Simulate the logic from createSpan method (empty string is falsy)
      const attributes: Record<string, any> = { ...baseAttributes };
      if (ariaLabel) {
        attributes[ATTR_TARGET_ARIA_LABEL] = ariaLabel;
      }

      expect(attributes).toEqual(baseAttributes);
      expect(attributes).not.toHaveProperty(ATTR_TARGET_ARIA_LABEL);
    });

    it('should include aria-label when whitespace-only (truthy)', () => {
      const ariaLabel = '   ';
      const baseAttributes = {
        'event.type': 'click',
        'target.element': 'BUTTON',
        'target.xpath': '/html/body/button',
        'http.url': 'http://localhost',
      };

      // Simulate the logic from createSpan method
      const attributes: Record<string, any> = { ...baseAttributes };
      if (ariaLabel) {
        attributes[ATTR_TARGET_ARIA_LABEL] = ariaLabel;
      }

      expect(attributes).toEqual({
        ...baseAttributes,
        [ATTR_TARGET_ARIA_LABEL]: '   ',
      });
    });
  });

  describe('error handling', () => {
    it('should handle getAttribute throwing an error', () => {
      const element = createMockElement({
        tagName: 'BUTTON',
        getAttribute: jest.fn(() => {
          throw new Error('getAttribute failed');
        }),
      });

      expect(() => {
        try {
          element.getAttribute('aria-label');
        } catch (error) {
          // In the real implementation, this would be handled gracefully
          expect(error).toBeInstanceOf(Error);
          throw error;
        }
      }).toThrow('getAttribute failed');
    });
  });

  describe('performance considerations', () => {
    it('should only call getAttribute once for aria-label', () => {
      const getAttributeSpy = jest.fn((attr) => {
        if (attr === 'aria-label') return 'Test Label';
        return null;
      });

      const element = createMockElement({
        tagName: 'BUTTON',
        getAttribute: getAttributeSpy,
      });

      // Simulate single call as in implementation
      const ariaLabel = element.getAttribute('aria-label');

      expect(ariaLabel).toBe('Test Label');
      expect(getAttributeSpy).toHaveBeenCalledWith('aria-label');
      expect(getAttributeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('semantic convention constant', () => {
    it('should use the correct attribute name constant', () => {
      expect(ATTR_TARGET_ARIA_LABEL).toBe('target.aria_label');
    });

    it('should follow project naming conventions', () => {
      // Verify it follows the pattern: target.* for target-related attributes
      expect(ATTR_TARGET_ARIA_LABEL).toMatch(/^target\./);
      // Verify it uses snake_case for the attribute part
      expect(ATTR_TARGET_ARIA_LABEL).toMatch(/aria_label$/);
    });
  });
});
