import { rumLogger } from '../shared/Logger';

/**
 * This class represents the local storage store.
 * It provides methods to get, set, and remove items from the local storage.
 */
export class LocalStorageStore {
  /**
   * Returns the value of the item with the given key.
   * @param key - The key of the item to get.
   * @returns The value of the item with the given key.
   */
  public static get(key: string): string | null {
    return localStorage.getItem(key);
  }

  /**
   * Sets the value of the item with the given key.
   * @param key - The key of the item to set.
   * @param value - The value of the item to set.
   */
  public static set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      rumLogger.error(`Failed to update localStorage key "${key}":`, e);
    }
  }

  /**
   * Removes the item with the given key.
   * @param key - The key of the item to remove.
   */
  public static remove(key: string): void {
    localStorage.removeItem(key);
  }
}
