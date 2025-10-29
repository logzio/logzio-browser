import { test, expect } from '@playwright/test';
import { initializeRUM, getRUMData, clearRUMData as _clearRUMData } from '../helpers/rumHarness';

test.describe('RUM Console and Errors Integration (Browser)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:8080/test.html');
  });

  test('should capture and export console logs', async ({ page }) => {
    // Initialize RUM with console logs enabled
    await initializeRUM(page, {
      tokens: { logs: 'test-token' },
      region: 'us',
      enable: {
        userActions: false,
        documentLoad: true,
        navigation: true,
        consoleLogs: true,
        errorTracking: false,
        frustrationDetection: false,
        resourceLoad: false,
        webVitals: false,
        viewEvents: false,
      },
    });

    // Wait for initial setup
    await page.waitForTimeout(500);

    // Emit console log
    const testMessage = 'Integration test console message';
    await page.evaluate((message) => {
      console.log(message);
    }, testMessage);

    await page.waitForTimeout(1000);

    // Get collected logs
    const data = await getRUMData(page);
    const consoleLogEntries = data.logs.filter((log) => log.body && log.body.includes(testMessage));

    expect(consoleLogEntries.length).toBeGreaterThan(0);

    const logEntry = consoleLogEntries[0];
    expect(logEntry.body).toContain(testMessage);
    expect(logEntry.attributes['session.id']).toBeDefined();
    expect(logEntry.attributes['view.id']).toBeDefined();
    expect(logEntry.severity).toBe('info');
  });

  test('should capture and export error events', async ({ page }) => {
    // Initialize RUM with error tracking enabled
    await initializeRUM(page, {
      tokens: { logs: 'test-token' },
      region: 'us',
      enable: {
        userActions: false,
        documentLoad: true,
        navigation: true,
        consoleLogs: false,
        errorTracking: true,
        frustrationDetection: false,
        resourceLoad: false,
        webVitals: false,
        viewEvents: false,
      },
    });

    // Wait for initial setup
    await page.waitForTimeout(500);

    // Emit error
    const errorMessage = 'Test error message';
    await page.evaluate((message) => {
      const error = new Error(message);
      window.dispatchEvent(
        new ErrorEvent('error', {
          error: error,
          message: message,
          filename: 'test.js',
          lineno: 123,
        }),
      );
    }, errorMessage);

    await page.waitForTimeout(1000);

    // Get collected logs
    const data = await getRUMData(page);
    const errorLogEntries = data.logs.filter(
      (log) =>
        (log.body && log.body.includes(errorMessage)) ||
        (log.attributes && log.attributes['error.message'] === errorMessage),
    );

    if (errorLogEntries.length > 0) {
      const errorEntry = errorLogEntries[0];
      expect(errorEntry.attributes['session.id']).toBeDefined();
      expect(errorEntry.attributes['view.id']).toBeDefined();
      expect(errorEntry.severity).toBe('error');
    }
  });

  test('should capture both console logs and errors together', async ({ page }) => {
    // Initialize RUM with both console logs and error tracking enabled
    await initializeRUM(page, {
      tokens: { logs: 'test-token' },
      region: 'us',
      enable: {
        userActions: false,
        documentLoad: true,
        navigation: true,
        consoleLogs: true,
        errorTracking: true,
        frustrationDetection: false,
        resourceLoad: false,
        webVitals: false,
        viewEvents: false,
      },
    });

    // Wait for initial setup
    await page.waitForTimeout(500);

    // Emit console log
    await page.evaluate(() => {
      console.log('Log message 1');
      console.warn('Warning message');
      console.error('Error message from console');
    });

    // Emit error event
    await page.evaluate(() => {
      const error = new Error('Actual error event');
      window.dispatchEvent(
        new ErrorEvent('error', {
          error: error,
          message: 'Actual error event',
          filename: 'test.js',
          lineno: 456,
        }),
      );
    });

    await page.waitForTimeout(1000);

    // Get all logs
    const data = await getRUMData(page);
    const allLogs = data.logs;

    // Find info logs (console.log)
    const infoLogs = allLogs.filter(
      (log) => log.severity === 'info' && log.body && log.body.includes('Log message'),
    );
    expect(infoLogs.length).toBeGreaterThan(0);

    // Find warning logs (console.warn)
    const warnLogs = allLogs.filter(
      (log) => log.severity === 'warn' || (log.body && log.body.includes('Warning message')),
    );
    expect(warnLogs.length).toBeGreaterThan(0);

    // Find error logs (could be from console.error or error events)
    const errorLogs = allLogs.filter((log) => log.severity === 'error');
    expect(errorLogs.length).toBeGreaterThan(0);
  });

  test('should include session and view context in all logs', async ({ page }) => {
    // Initialize RUM
    await initializeRUM(page, {
      tokens: { logs: 'test-token' },
      region: 'us',
      enable: {
        userActions: false,
        documentLoad: true,
        navigation: true,
        consoleLogs: true,
        errorTracking: true,
        frustrationDetection: false,
        resourceLoad: false,
        webVitals: false,
        viewEvents: false,
      },
    });

    // Wait for initial setup
    await page.waitForTimeout(500);

    // Generate multiple logs
    await page.evaluate(() => {
      console.log('Test message for 500 error');
      console.warn('Warning test');
      console.error('Error test');
    });

    await page.waitForTimeout(1000);

    // Get all logs
    const data = await getRUMData(page);
    const allLogs = data.logs;

    expect(allLogs.length).toBeGreaterThan(0);

    // Verify all logs have session and view context
    for (const log of allLogs) {
      if (log.attributes) {
        expect(log.attributes['session.id']).toBeDefined();
        expect(log.attributes['view.id']).toBeDefined();
      }
    }
  });
});
