/**
 * @jest-environment jsdom
 */

import {
  setupUserInteractionsTest,
  testInstrumentationLogic,
} from '../__utils__/userInteractionsTestHelpers';

describe('UserInteractions Frustration Detection', () => {
  let logic: ReturnType<typeof testInstrumentationLogic>;

  beforeEach(() => {
    setupUserInteractionsTest();
    logic = testInstrumentationLogic();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should detect rage clicks when threshold is exceeded', () => {
    const clickHistory = [
      { timestamp: 100, targetElement: 'BUTTON' },
      { timestamp: 200, targetElement: 'BUTTON' },
      { timestamp: 300, targetElement: 'BUTTON' },
    ];

    const currentTime = 350;
    const threshold = 3;
    const interval = 1000;

    const isRage = logic.isRageClick(clickHistory, currentTime, 'BUTTON', threshold, interval);

    expect(isRage).toBe(true);
  });

  it('should not detect rage clicks when threshold is not met', () => {
    const clickHistory = [
      { timestamp: 100, targetElement: 'BUTTON' },
      { timestamp: 200, targetElement: 'BUTTON' },
    ];

    const currentTime = 350;
    const threshold = 3;
    const interval = 1000;

    const isRage = logic.isRageClick(clickHistory, currentTime, 'BUTTON', threshold, interval);

    expect(isRage).toBe(false);
  });

  it('should detect dead clicks when no activity occurs', () => {
    const activities = 0;
    const isDead = logic.isDeadClick(activities);

    expect(isDead).toBe(true);
  });

  it('should not detect dead clicks when activity occurs', () => {
    const activities = 2;
    const isDead = logic.isDeadClick(activities);

    expect(isDead).toBe(false);
  });

  it('should detect error clicks when errors occur', () => {
    const errors = 2;
    const isError = logic.isErrorClick(errors);

    expect(isError).toBe(true);
  });

  it('should not detect error clicks when no errors occur', () => {
    const errors = 0;
    const isError = logic.isErrorClick(errors);

    expect(isError).toBe(false);
  });
});
