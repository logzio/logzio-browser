/**
 * Represents the current active view information.
 * This is an immutable snapshot of view state.
 */
export interface ActiveViewInfo {
  id: string;
  url: string;
  startedAt: number;
  durationMs: number;
}
