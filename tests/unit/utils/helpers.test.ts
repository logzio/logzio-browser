import { getIfBetween, getIfMoreThan, generateId } from '@src/utils/helpers';

describe('getIfBetween', () => {
  it('should return the value when it is between min and max (inclusive)', () => {
    expect(getIfBetween(5, 1, 10, 0)).toBe(5);
    expect(getIfBetween(1, 1, 10, 0)).toBe(1);
    expect(getIfBetween(10, 1, 10, 0)).toBe(10);
  });

  it('should return the fallback when the value is less than min', () => {
    expect(getIfBetween(0, 1, 10, 100)).toBe(100);
    expect(getIfBetween(0, 1, 10, 99)).toBe(99);
    expect(getIfBetween(-5, 0, 10, 99)).toBe(99);
  });

  it('should return the fallback when the value is greater than max', () => {
    expect(getIfBetween(11, 1, 10, 0)).toBe(0);
    expect(getIfBetween(11, 1, 10, 99)).toBe(99);
    expect(getIfBetween(100, 1, 10, 99)).toBe(99);
  });

  it('should return the fallback when the value is undefined', () => {
    expect(getIfBetween(undefined, 1, 10, 0)).toBe(0);
  });

  it('should handle edge cases with same min and max', () => {
    expect(getIfBetween(5, 5, 5, 99)).toBe(5);
    expect(getIfBetween(4, 5, 5, 99)).toBe(99);
    expect(getIfBetween(6, 5, 5, 99)).toBe(99);
  });

  it('should handle negative numbers', () => {
    expect(getIfBetween(-5, -10, -1, 99)).toBe(-5);
    expect(getIfBetween(-15, -10, -1, 99)).toBe(99);
    expect(getIfBetween(0, -10, -1, 99)).toBe(99);
  });

  it('should handle floating point numbers', () => {
    expect(getIfBetween(3.14, 0, 10, 99)).toBe(3.14);
    expect(getIfBetween(10.1, 0, 10, 99)).toBe(99);
  });
});

describe('getIfMoreThan', () => {
  it('should return the value when it is more than min', () => {
    expect(getIfMoreThan(5, 1, 0)).toBe(5);
    expect(getIfMoreThan(1.1, 1, 0)).toBe(1.1);
    expect(getIfMoreThan(100, 1, 0)).toBe(100);
  });

  it('should return the fallback when the value is equal to min', () => {
    expect(getIfMoreThan(1, 1, 0)).toBe(0);
    expect(getIfMoreThan(0, 0, 99)).toBe(99);
    expect(getIfMoreThan(-5, -5, 99)).toBe(99);
  });

  it('should return the fallback when the value is less than min', () => {
    expect(getIfMoreThan(0, 1, 99)).toBe(99);
    expect(getIfMoreThan(-10, 1, 99)).toBe(99);
  });

  it('should return the fallback when the value is undefined', () => {
    expect(getIfMoreThan(undefined, 1, 99)).toBe(99);
  });

  it('should handle negative numbers', () => {
    expect(getIfMoreThan(-1, -5, 99)).toBe(-1);
    expect(getIfMoreThan(-5, -5, 99)).toBe(99);
    expect(getIfMoreThan(-10, -5, 99)).toBe(99);
  });

  it('should handle floating point numbers', () => {
    expect(getIfMoreThan(1.001, 1, 99)).toBe(1.001);
    expect(getIfMoreThan(0.999, 1, 99)).toBe(99);
  });
});

describe('generateId', () => {
  it('should generate a unique UUID v4', () => {
    const id1 = generateId();
    const id2 = generateId();

    expect(id1).toBeDefined();
    expect(id2).toBeDefined();
    expect(id1).not.toBe(id2);

    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(id1).toMatch(uuidV4Regex);
    expect(id2).toMatch(uuidV4Regex);
  });

  it('should generate multiple unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
      ids.add(generateId());
    }
    expect(ids.size).toBe(100);
  });
});
