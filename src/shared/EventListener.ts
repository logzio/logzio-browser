import { DOM_EVENT } from './constants';
import { rumLogger } from './Logger';

/**
 * This class represents an event listener.
 * It provides methods to add and remove event listeners.
 */
export class EventListener<T extends Event = Event> {
  private target: EventTarget | null = null;
  private eventType: DOM_EVENT | null = null;
  private handler: EventListenerOrEventListenerObject | null = null;
  private options: boolean | AddEventListenerOptions | undefined;

  /**
   * Sets the event listener.
   * @param target - The target to add the event listener to.
   * @param eventType - The type of event to listen for.
   * @param handler - The handler to call when the event occurs.
   * @param options - The options for the event listener.
   */
  public set(
    target: EventTarget,
    eventType: DOM_EVENT,
    handler: (this: EventTarget, e: T) => void,
    options?: boolean | AddEventListenerOptions,
  ): void {
    this.target = target;
    this.eventType = eventType;
    this.handler = handler as EventListenerOrEventListenerObject;
    this.options = options;

    try {
      if (typeof this.target?.addEventListener === 'function') {
        this.target.addEventListener(this.eventType, this.handler, this.options);
      }
    } catch (error) {
      rumLogger.error('Failed to add event listener: ', error);
    }
  }

  /**
   * Removes the event listener.
   */
  public remove(): void {
    if (this.target && this.eventType && this.handler) {
      try {
        if (typeof this.target?.removeEventListener === 'function') {
          this.target.removeEventListener(this.eventType, this.handler, this.options);
        }
      } catch (error) {
        rumLogger.error('Failed to remove event listener: ', error);
      }
    }
    this.target = null;
    this.eventType = null;
    this.handler = null;
    this.options = undefined;
  }
}
