import { isClickableElement, isPassiveInteractiveControl } from '@src/utils/domInteractivity';

describe('domInteractivity', () => {
  let mockElement: any;

  beforeEach(() => {
    // Create a mock element with common properties
    mockElement = {
      tagName: 'DIV',
      hasAttribute: jest.fn(),
      getAttribute: jest.fn(),
      onclick: null,
      tabIndex: -1,
      isContentEditable: false,
      type: 'text', // For input elements
    };

    // Mock getComputedStyle
    global.getComputedStyle = jest.fn().mockReturnValue({
      display: 'block',
      visibility: 'visible',
      pointerEvents: 'auto',
      cursor: 'default',
    });
  });

  describe('isClickableElement', () => {
    it('should return true for button elements', () => {
      mockElement.tagName = 'BUTTON';
      expect(isClickableElement(mockElement)).toBe(true);
    });

    it('should return true for links with href', () => {
      mockElement.tagName = 'A';
      (mockElement.hasAttribute as jest.Mock).mockImplementation((attr) => attr === 'href');
      expect(isClickableElement(mockElement)).toBe(true);
    });

    it('should return false for links without href', () => {
      mockElement.tagName = 'A';
      (mockElement.hasAttribute as jest.Mock).mockReturnValue(false);
      expect(isClickableElement(mockElement)).toBe(false);
    });

    it('should return true for clickable input types', () => {
      mockElement.tagName = 'INPUT';
      mockElement.type = 'button';
      expect(isClickableElement(mockElement)).toBe(true);

      mockElement.type = 'submit';
      expect(isClickableElement(mockElement)).toBe(true);

      mockElement.type = 'checkbox';
      expect(isClickableElement(mockElement)).toBe(true);
    });

    it('should return false for non-clickable input types', () => {
      mockElement.tagName = 'INPUT';
      mockElement.type = 'text';
      expect(isClickableElement(mockElement)).toBe(false);
    });

    it('should return true for elements with actionable roles', () => {
      mockElement.tagName = 'DIV';
      (mockElement.getAttribute as jest.Mock).mockImplementation((attr) =>
        attr === 'role' ? 'button' : null,
      );
      (mockElement.hasAttribute as jest.Mock).mockImplementation((attr) => attr === 'role');
      expect(isClickableElement(mockElement)).toBe(true);
    });

    it('should return true for elements with click handlers and pointer cursor', () => {
      mockElement.tagName = 'DIV';
      mockElement.onclick = () => {};
      mockElement.tabIndex = 0;
      global.getComputedStyle = jest.fn().mockReturnValue({
        display: 'block',
        visibility: 'visible',
        pointerEvents: 'auto',
        cursor: 'pointer',
      });
      expect(isClickableElement(mockElement)).toBe(true);
    });

    it('should return false for disabled elements', () => {
      mockElement.tagName = 'BUTTON';
      (mockElement.hasAttribute as jest.Mock).mockImplementation((attr) => attr === 'disabled');
      expect(isClickableElement(mockElement)).toBe(false);
    });

    it('should return false for hidden elements', () => {
      mockElement.tagName = 'BUTTON';
      global.getComputedStyle = jest.fn().mockReturnValue({
        display: 'none',
        visibility: 'visible',
        pointerEvents: 'auto',
        cursor: 'default',
      });
      expect(isClickableElement(mockElement)).toBe(false);
    });

    it('should return false for non-interactive containers without click handlers', () => {
      mockElement.tagName = 'DIV';
      mockElement.onclick = null;
      (mockElement.hasAttribute as jest.Mock).mockReturnValue(false);
      expect(isClickableElement(mockElement)).toBe(false);
    });

    it('should return true for summary elements', () => {
      mockElement.tagName = 'SUMMARY';
      expect(isClickableElement(mockElement)).toBe(true);
    });

    it('should return true for area elements with href', () => {
      mockElement.tagName = 'AREA';
      (mockElement.hasAttribute as jest.Mock).mockImplementation((attr) => attr === 'href');
      expect(isClickableElement(mockElement)).toBe(true);
    });
  });

  describe('isPassiveInteractiveControl', () => {
    it('should return true for form control elements', () => {
      mockElement.tagName = 'INPUT';
      mockElement.type = 'text';
      expect(isPassiveInteractiveControl(mockElement)).toBe(true);

      mockElement.tagName = 'TEXTAREA';
      expect(isPassiveInteractiveControl(mockElement)).toBe(true);

      mockElement.tagName = 'SELECT';
      expect(isPassiveInteractiveControl(mockElement)).toBe(true);
    });

    it('should return false for hidden input elements', () => {
      mockElement.tagName = 'INPUT';
      mockElement.type = 'hidden';
      expect(isPassiveInteractiveControl(mockElement)).toBe(false);
    });

    it('should return true for contenteditable elements', () => {
      mockElement.tagName = 'DIV';
      mockElement.isContentEditable = true;
      expect(isPassiveInteractiveControl(mockElement)).toBe(true);
    });

    it('should return true for elements with passive interactive roles', () => {
      mockElement.tagName = 'DIV';
      (mockElement.getAttribute as jest.Mock).mockImplementation((attr) =>
        attr === 'role' ? 'textbox' : null,
      );
      expect(isPassiveInteractiveControl(mockElement)).toBe(true);

      (mockElement.getAttribute as jest.Mock).mockImplementation((attr) =>
        attr === 'role' ? 'combobox' : null,
      );
      expect(isPassiveInteractiveControl(mockElement)).toBe(true);

      (mockElement.getAttribute as jest.Mock).mockImplementation((attr) =>
        attr === 'role' ? 'slider' : null,
      );
      expect(isPassiveInteractiveControl(mockElement)).toBe(true);
    });

    it('should return false for non-passive interactive elements', () => {
      mockElement.tagName = 'BUTTON';
      expect(isPassiveInteractiveControl(mockElement)).toBe(false);

      mockElement.tagName = 'DIV';
      (mockElement.getAttribute as jest.Mock).mockImplementation((attr) =>
        attr === 'role' ? 'button' : null,
      );
      expect(isPassiveInteractiveControl(mockElement)).toBe(false);
    });

    it('should return false for elements without special attributes', () => {
      mockElement.tagName = 'DIV';
      mockElement.isContentEditable = false;
      (mockElement.getAttribute as jest.Mock).mockReturnValue(null);
      expect(isPassiveInteractiveControl(mockElement)).toBe(false);
    });
  });
});
