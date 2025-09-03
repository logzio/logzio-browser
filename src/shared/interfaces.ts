/**
 * Shared interfaces for cross-module contracts.
 * These interfaces help avoid circular dependencies by providing contracts
 * that modules can depend on without importing concrete implementations.
 */

/**
 * Interface for session management functionality.
 * This allows processors and other components to access session/view data
 * without directly depending on the RUMSessionManager implementation.
 */
export interface SessionManager {
  /**
   * Gets the current session ID.
   * @returns The session ID or null if no active session
   */
  getSessionId(): string | null;

  /**
   * Gets the currently active view information.
   * @returns The active view info or null if no active view
   */
  getActiveView(): { id: string; url: string; startedAt: number } | null;

  /**
   * Gets the view that was active at a specific timestamp.
   * @param timestamp - The timestamp to check
   * @returns The view info that was active at that time or null
   */
  getActiveViewAt(timestamp: number): { id: string; url: string; startedAt: number } | null;
}
