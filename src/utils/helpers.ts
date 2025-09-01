import { v4 as uuidv4 } from 'uuid';

/**
 * Returns the given value if it is between the given min and max, otherwise returns the fallback.
 * @param value - The value to check.
 * @param min - The minimum value.
 * @param max - The maximum value.
 * @param fallback - The fallback value.
 */
export function getIfBetween(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  return value !== undefined && value >= min && value <= max ? value : fallback;
}

/**
 * Returns the given value if it is more than the given min, otherwise returns the fallback.
 * @param value - The value to check.
 * @param min - The minimum value.
 * @param fallback - The fallback value.
 */
export function getIfMoreThan(value: number | undefined, min: number, fallback: number): number {
  return value !== undefined && value > min ? value : fallback;
}

/**
 * Generates a unique uuid.
 * @returns a unique id.
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Generates an authorization header.
 * @param token - The token to generate the header for.
 * @returns the authorization header.
 */
export function getAuthorizationHeader(token: string): string {
  return `Bearer ${token}`;
}
