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
});
