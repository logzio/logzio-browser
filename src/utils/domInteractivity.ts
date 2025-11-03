/**
 * DOM Interactivity Utilities
 *
 * Provides optimized helpers to determine element interactivity for dead click detection.
 * Based on industry best practices and semantic HTML standards.
 */

// Precomputed sets for fast membership checks
const CLICKABLE_TAGS = new Set(['button', 'summary']);
const CLICKABLE_INPUT_TYPES = new Set(['button', 'submit', 'reset', 'checkbox', 'radio']);
const FORM_CONTROL_TAGS = new Set(['input', 'textarea', 'select']);
const ACTIONABLE_ROLES = new Set(['button', 'link', 'menuitem', 'tab', 'switch']);
const PASSIVE_INTERACTIVE_ROLES = new Set([
  'textbox',
  'combobox',
  'listbox',
  'slider',
  'spinbutton',
  'checkbox',
  'radio',
  'option',
  'tab',
]);

/**
 * Determines if an element is expected to perform an action when clicked.
 * Returns true for elements that should trigger some visible or functional change.
 *
 * @param element - The HTML element to check
 * @returns true if the element is expected to be clickable and perform an action
 */
export function isClickableElement(element: HTMLElement): boolean {
  const tagName = element.tagName.toLowerCase();

  // Skip if element is inert or disabled
  if (isElementInert(element)) {
    return false;
  }

  // Native interactive elements that perform actions
  if (CLICKABLE_TAGS.has(tagName)) {
    return true;
  }

  // Links with href attribute
  if (tagName === 'a' && element.hasAttribute('href')) {
    return true;
  }

  // Area elements with href (image maps)
  if (tagName === 'area' && element.hasAttribute('href')) {
    return true;
  }

  // Input elements that act like buttons
  if (tagName === 'input') {
    const type = (element as HTMLInputElement).type?.toLowerCase() || 'text';
    return CLICKABLE_INPUT_TYPES.has(type);
  }

  // Links without href are not clickable
  if (tagName === 'a') {
    return false;
  }

  // Area elements without href are not clickable
  if (tagName === 'area') {
    return false;
  }

  // Elements with actionable ARIA roles (not disabled)
  const role = element.getAttribute('role');
  if (role && ACTIONABLE_ROLES.has(role) && !isAriaDisabled(element)) {
    return true;
  }

  // Explicitly exclude common React root containers to avoid false positives from event delegation
  const isReactRoot =
    element.id === 'root' || element.id === 'app' || tagName === 'body' || tagName === 'html';
  if (isReactRoot) {
    return false;
  }

  // Elements with click handlers and pointer cursor (strong signal of intentional clickability)
  if (hasClickHandler(element) && hasPointerCursor(element) && element.tabIndex >= 0) {
    return true;
  }

  // Conservative default: don't track clicks on common non-interactive containers
  const nonInteractiveContainers = new Set([
    'html',
    'body',
    'div',
    'span',
    'p',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'section',
    'article',
    'header',
    'footer',
    'nav',
    'main',
    'aside',
  ]);

  if (nonInteractiveContainers.has(tagName) && !hasClickHandler(element)) {
    return false;
  }

  // Default: track other elements (conservative approach for unknown interactive elements)
  return true;
}

/**
 * Determines if an element is a passive interactive control where focus/selection
 * is the expected outcome rather than a visible action.
 *
 * @param element - The HTML element to check
 * @returns true if the element is a passive interactive control
 */
export function isPassiveInteractiveControl(element: HTMLElement): boolean {
  const tagName = element.tagName.toLowerCase();

  // Form controls where focus/selection is the expected outcome
  if (FORM_CONTROL_TAGS.has(tagName)) {
    // Exclude hidden inputs as they're not interactive
    if (tagName === 'input') {
      const type = (element as HTMLInputElement).type?.toLowerCase() || 'text';
      return type !== 'hidden';
    }
    return true;
  }

  // Elements with contenteditable
  if (element.isContentEditable) {
    return true;
  }

  // Interactive roles where focus/state change is expected
  const role = element.getAttribute('role');
  if (role && PASSIVE_INTERACTIVE_ROLES.has(role)) {
    return true;
  }

  return false;
}

/**
 * Checks if an element is inert (disabled, hidden, or otherwise non-interactive)
 */
function isElementInert(element: HTMLElement): boolean {
  // Check disabled attribute
  if (element.hasAttribute('disabled') || isAriaDisabled(element)) {
    return true;
  }

  // Check inert attribute
  if (element.hasAttribute('inert')) {
    return true;
  }

  // Check hidden attribute
  if (element.hasAttribute('hidden')) {
    return true;
  }

  // Check computed styles for visibility/display
  const computedStyle = getComputedStyle(element);
  if (
    computedStyle.display === 'none' ||
    computedStyle.visibility === 'hidden' ||
    computedStyle.pointerEvents === 'none'
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if an element is disabled via ARIA
 */
function isAriaDisabled(element: HTMLElement): boolean {
  return element.getAttribute('aria-disabled') === 'true';
}

/**
 * Checks if an element has a click handler
 */
function hasClickHandler(element: HTMLElement): boolean {
  return !!(element.onclick || element.hasAttribute('onclick'));
}

/**
 * Checks if an element has pointer cursor style
 */
function hasPointerCursor(element: HTMLElement): boolean {
  const computedStyle = getComputedStyle(element);
  return computedStyle.cursor === 'pointer';
}

/**
 * Finds the closest actionable ancestor element that should be tracked for user interactions.
 * Walks up the DOM tree from the given element to find the first clickable ancestor.
 *
 * @param element - The starting element (typically event.target)
 * @returns The closest actionable ancestor, or null if none found
 */
export function findActionableAncestor(element: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = element;

  // Walk up the DOM tree, but limit traversal to avoid infinite loops
  let depth = 0;
  const MAX_TRAVERSAL_DEPTH = 10;

  while (current && depth < MAX_TRAVERSAL_DEPTH) {
    if (isClickableElement(current)) {
      return current;
    }

    current = current.parentElement;
    depth++;
  }

  return null;
}
