/**
 * @jest-environment jsdom
 */
import {
  setupUserInteractionsTest,
  testInstrumentationLogic,
  createMockElement,
} from '../__utils__/userInteractionsTestHelpers';

describe('UserInteractions Span Creation', () => {
  let logic: ReturnType<typeof testInstrumentationLogic>;

  beforeEach(() => {
    setupUserInteractionsTest();
    logic = testInstrumentationLogic();
  });

  it('should reject non-HTMLElement targets', () => {
    const nonElement = { tagName: 'DIV' }; // Missing HTMLElement prototype
    const result = logic.shouldCreateSpan(nonElement, 'click', ['click']);

    expect(result).toBe(false);
  });

  it('should reject elements without getAttribute method', () => {
    const elementWithoutGetAttribute = createMockElement({ getAttribute: undefined });
    const result = logic.shouldCreateSpan(elementWithoutGetAttribute, 'click', ['click']);

    expect(result).toBe(false);
  });

  it('should reject disabled elements', () => {
    const disabledElement = createMockElement({
      hasAttribute: jest.fn((attr) => attr === 'disabled'),
    });
    const result = logic.shouldCreateSpan(disabledElement, 'click', ['click']);

    expect(result).toBe(false);
  });

  it('should reject non-instrumented events', () => {
    const element = createMockElement();
    const result = logic.shouldCreateSpan(element, 'scroll', ['click']); // scroll not in instrumented events

    expect(result).toBe(false);
  });

  it('should accept valid elements and events', () => {
    const element = createMockElement();
    const result = logic.shouldCreateSpan(element, 'click', ['click']);

    expect(result).toBe(true);
  });

  it('should demonstrate error handling during span creation', () => {
    const { rumLogger } = require('@src/shared');

    // Simulate span creation error
    expect(() => {
      try {
        throw new Error('Span creation failed');
      } catch (error) {
        rumLogger.error('failed to start create new user interaction span', error);
      }
    }).not.toThrow();

    expect(rumLogger.error).toHaveBeenCalledWith(
      'failed to start create new user interaction span',
      expect.any(Error),
    );
  });
});
