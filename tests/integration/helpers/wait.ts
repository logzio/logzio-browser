import { SignalKind, CollectorInstance } from '../collector/types';

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForRequests(
  collector: CollectorInstance,
  kind: SignalKind,
  expectedCount: number,
  timeoutMs: number = 5000,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const currentCount = collector.received[kind].length;

    if (currentCount >= expectedCount) {
      return;
    }

    await sleep(50); // Check every 50ms
  }

  const actualCount = collector.received[kind].length;
  throw new Error(
    `Timeout waiting for ${expectedCount} ${kind} requests. Got ${actualCount} after ${timeoutMs}ms`,
  );
}

export async function waitForMinimumRequests(
  collector: CollectorInstance,
  kind: SignalKind,
  minimumCount: number,
  timeoutMs: number = 5000,
): Promise<void> {
  return waitForRequests(collector, kind, minimumCount, timeoutMs);
}
