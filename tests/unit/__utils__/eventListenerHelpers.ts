/**
 * Helpers for working with EventListener mocks in tests
 */

/**
 * Finds the handler function for a specific event from EventListener mock instances
 * @param eventListenerInstances Array of mocked EventListener instances
 * @param eventName The event name to find the handler for
 * @returns The handler function or undefined if not found
 */
export const findListenerHandler = (eventListenerInstances: any[], eventName: string) => {
  const listener = eventListenerInstances.find((l) =>
    l.set.mock.calls.some((call: any) => call[1] === eventName),
  );
  return listener?.set.mock.calls.find((call: any) => call[1] === eventName)?.[2];
};

/**
 * Finds all handlers for a specific event from EventListener mock instances
 * @param eventListenerInstances Array of mocked EventListener instances
 * @param eventName The event name to find handlers for
 * @returns Array of handler functions
 */
export const findAllListenerHandlers = (eventListenerInstances: any[], eventName: string) => {
  const handlers: (() => void)[] = [];
  eventListenerInstances.forEach((listener) => {
    listener.set.mock.calls.forEach((call: any) => {
      if (call[1] === eventName) {
        handlers.push(call[2]);
      }
    });
  });
  return handlers;
};

/**
 * Gets the target element from an EventListener set call
 * @param eventListenerInstances Array of mocked EventListener instances
 * @param eventName The event name to find the target for
 * @returns The target element or undefined if not found
 */
export const findListenerTarget = (eventListenerInstances: any[], eventName: string) => {
  const listener = eventListenerInstances.find((l) =>
    l.set.mock.calls.some((call: any) => call[1] === eventName),
  );
  return listener?.set.mock.calls.find((call: any) => call[1] === eventName)?.[0];
};
