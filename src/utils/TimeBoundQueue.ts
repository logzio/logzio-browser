/**
 * Generic queue that automatically removes items older than `windowMs`.
 * `getTs` lets you specify how to extract a timestamp from T.
 */
export class TimeBoundQueue<T> {
  private q: T[] = [];

  constructor(
    private readonly windowMs: number,
    private readonly getTs: (item: T) => number = (item: any) => item.timestamp as number,
  ) {}

  /**
   * Adds an item to the queue.
   * @param item the item to add to the queue.
   */
  push(item: T): void {
    const threshold = Date.now() - this.windowMs;

    // Only add the item if it's within the time window
    if (this.getTs(item) > threshold) {
      this.q.push(item);
    }

    // Trim old items from the front
    this.trim();
  }

  /**
   * Returns the items in the queue.
   * @returns the current queue items.
   */
  values(): readonly T[] {
    return [...this.q];
  }

  /**
   * Trims the queue to remove items older than the window. Amortised O(1).
   */
  private trim(): void {
    const threshold = Date.now() - this.windowMs;
    while (this.q.length && this.getTs(this.q[0]) <= threshold) {
      this.q.shift();
    }
  }
}
