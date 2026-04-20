import { rumLogger, MUTATION_IGNORED_TAGS, MUTATION_SIGNIFICANT_ATTRIBUTES } from '../../shared';

export interface MutationEventData {
  timestamp: number;
  mutationType: 'childList' | 'attributes' | 'characterData';
  target: Element;
  significantChange: boolean;
}

export type MutationEventHandler = (eventData: MutationEventData) => void;

/**
 * Tracks DOM mutations using MutationObserver for dead click detection.
 * Optimized for performance by filtering out irrelevant mutations.
 */
export class MutationObserverTracker {
  private static instance: MutationObserverTracker | null = null;
  private subscribers: Set<MutationEventHandler> = new Set();
  private observer: MutationObserver | null = null;
  private isInitialized = false;
  private pendingMutations: MutationEventData[] = [];
  private rafId: number | null = null;

  private constructor() {}

  /**
   * Implements the singleton pattern.
   */
  public static getInstance(): MutationObserverTracker {
    if (!MutationObserverTracker.instance) {
      MutationObserverTracker.instance = new MutationObserverTracker();
    }
    return MutationObserverTracker.instance;
  }

  /**
   * Initializes the mutation observer
   */
  public init(): void {
    if (this.isInitialized || typeof MutationObserver === 'undefined') {
      return;
    }

    try {
      this.observer = new MutationObserver(this.handleMutations.bind(this));
      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'hidden', 'disabled'], // Only track relevant attributes
        characterData: true,
        characterDataOldValue: false, // Performance optimization
        attributeOldValue: false, // Performance optimization
      });
      this.isInitialized = true;
      rumLogger.debug('MutationObserver initialized for dead click detection');
    } catch (error) {
      rumLogger.error('Failed to initialize MutationObserver:', error);
    }
  }

  /**
   * Subscribes to mutation events
   * @param handler - The callback function to execute when mutations occur
   * @returns Unsubscribe function to remove the subscription
   */
  public subscribe(handler: MutationEventHandler): () => void {
    this.subscribers.add(handler);

    return () => {
      this.subscribers.delete(handler);
    };
  }

  /**
   * Handles mutation events from MutationObserver
   * @param mutations - Array of MutationRecord objects
   */
  private handleMutations(mutations: MutationRecord[]): void {
    const timestamp = Date.now();

    for (const mutation of mutations) {
      // Filter out irrelevant mutations for performance
      if (!this.isSignificantMutation(mutation)) {
        continue;
      }

      const eventData: MutationEventData = {
        timestamp,
        mutationType: mutation.type,
        target: mutation.target as Element,
        significantChange: true,
      };

      // Batch notifications: if RAF is available, defer; otherwise notify synchronously
      if (typeof requestAnimationFrame !== 'undefined') {
        this.pendingMutations.push(eventData);
        if (this.rafId === null) {
          this.rafId = requestAnimationFrame(() => this.flushPendingMutations());
        }
      } else {
        this.notify(eventData);
      }
    }
  }

  /**
   * Drains the pending mutations buffer and notifies subscribers.
   * Swaps to a new array before draining so re-entrant mutations go into a fresh buffer.
   */
  private flushPendingMutations(): void {
    this.rafId = null;
    const mutations = this.pendingMutations;
    this.pendingMutations = [];

    for (const eventData of mutations) {
      this.notify(eventData);
    }
  }

  /**
   * Determines if a mutation is significant for dead click detection
   * @param mutation - The MutationRecord to evaluate
   * @returns true if the mutation is significant
   */
  private isSignificantMutation(mutation: MutationRecord): boolean {
    const target = mutation.target;

    // Ignore mutations on script, style, and meta tags
    if (target instanceof Element) {
      const tagName = target.tagName.toLowerCase();
      if (MUTATION_IGNORED_TAGS.includes(tagName as any)) {
        return false;
      }

      // Ignore mutations on elements with data-rum-ignore attribute
      if (target.hasAttribute('data-rum-ignore')) {
        return false;
      }
    }

    // Check mutation type significance
    switch (mutation.type) {
      case 'childList':
        // Only significant if nodes were added/removed and they're visible elements
        return this.hasSignificantChildListChanges(mutation);

      case 'attributes':
        // Only track attributes that affect visibility or user interaction
        return this.hasSignificantAttributeChanges(mutation);

      case 'characterData':
        // Text content changes are generally significant
        return this.hasSignificantTextChanges(mutation);

      default:
        return false;
    }
  }

  /**
   * Checks if childList mutations are significant
   */
  private hasSignificantChildListChanges(mutation: MutationRecord): boolean {
    // Check added nodes
    if (mutation.addedNodes.length > 0) {
      for (const node of Array.from(mutation.addedNodes)) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as Element;
          // Ignore hidden elements or elements with no content
          if (this.isVisibleElement(element)) {
            return true;
          }
        } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
          return true;
        }
      }
    }

    // Check removed nodes
    if (mutation.removedNodes.length > 0) {
      for (const node of Array.from(mutation.removedNodes)) {
        if (
          node.nodeType === Node.ELEMENT_NODE ||
          (node.nodeType === Node.TEXT_NODE && node.textContent?.trim())
        ) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Checks if attribute mutations are significant
   */
  private hasSignificantAttributeChanges(mutation: MutationRecord): boolean {
    const attributeName = mutation.attributeName;
    if (!attributeName) return false;

    // Track attributes that affect visibility or interaction
    return MUTATION_SIGNIFICANT_ATTRIBUTES.includes(attributeName as any);
  }

  /**
   * Checks if text content changes are significant
   */
  private hasSignificantTextChanges(mutation: MutationRecord): boolean {
    const target = mutation.target;
    if (target.nodeType !== Node.TEXT_NODE) return false;

    // Only significant if the text content is not empty
    return Boolean(target.textContent?.trim());
  }

  /**
   * Checks if an element is visible and significant
   */
  private isVisibleElement(element: Element): boolean {
    // Basic visibility check - avoid expensive getComputedStyle for performance
    if (element.hasAttribute('hidden')) return false;
    if (element.getAttribute('style')?.includes('display: none')) return false;
    if (element.getAttribute('style')?.includes('visibility: hidden')) return false;

    return true;
  }

  /**
   * Notifies all subscribers of a mutation event
   * @param eventData - The mutation event data
   */
  private notify(eventData: MutationEventData): void {
    if (this.subscribers.size > 0) {
      this.subscribers.forEach((handler) => {
        try {
          handler(eventData);
        } catch (error) {
          rumLogger.error('Error in mutation event handler:', error);
        }
      });
    }
  }

  /**
   * Shuts down the mutation observer and cleans up
   */
  public static shutdown(): void {
    const tracker = MutationObserverTracker.instance;
    if (tracker) {
      if (tracker.observer) {
        tracker.observer.disconnect();
        tracker.observer = null;
      }
      if (tracker.rafId !== null) {
        cancelAnimationFrame(tracker.rafId);
        tracker.rafId = null;
      }
      tracker.pendingMutations = [];
      tracker.subscribers.clear();
      tracker.isInitialized = false;
    }
    MutationObserverTracker.instance = null;
  }
}
