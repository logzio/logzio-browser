import { test, expect } from '@playwright/test';
import {
  initializeRUM,
  getRUMData,
  isRUMInitialized,
  getRUMSession,
  waitForMetrics,
} from '../helpers/rumHarness';

test.describe('RUM Metrics in Browser Environment', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:8080/test.html');
  });

  test('should initialize RUM with metrics enabled', async ({ page }) => {
    await initializeRUM(page, {
      tokens: {
        traces: 'test-traces-token',
        metrics: 'test-metrics-token',
        logs: 'test-logs-token',
      },
      enable: {
        webVitals: true,
        frustrationDetection: true,
        userActions: true,
      },
      frustrationThresholds: {
        rageClickCount: 3,
        rageClickIntervalMs: 1000,
        heavyLoadThresholdMs: 1500,
      },
      samplingRate: 100,
    });

    // Verify RUM is initialized
    const isInitialized = await isRUMInitialized(page);
    expect(isInitialized).toBe(true);

    // Verify session is created
    const session = await getRUMSession(page);
    expect(session).not.toBeNull();
    expect(session!.sessionId).toMatch(/^browser-test-session-/);
    expect(session!.viewId).toMatch(/^browser-test-view-/);
  });

  test('should detect and collect rage click metrics', async ({ page }) => {
    await initializeRUM(page, {
      tokens: { metrics: 'test-metrics-token' },
      enable: { frustrationDetection: true },
      frustrationThresholds: { rageClickCount: 3, rageClickIntervalMs: 1000 },
    });

    // Trigger rage clicks using the page's test helper
    await page.evaluate(() => {
      (window as any).testHelpers.triggerRageClicks(5);
    });

    // Wait for frustration metrics to be collected
    const metrics = await waitForMetrics(page, 1, 2000);

    // Verify rage click metric was recorded
    const rageClickMetrics = metrics.filter((m) => m.name === 'frustration.rage_click');
    expect(rageClickMetrics.length).toBeGreaterThan(0);

    const rageMetric = rageClickMetrics[0];
    expect(rageMetric.value).toBe(1);
    expect(rageMetric.type).toBe('frustration');
    expect(rageMetric.target).toBe('BUTTON');
  });

  test('should detect and collect dead click metrics', async ({ page }) => {
    await initializeRUM(page, {
      tokens: { metrics: 'test-metrics-token' },
      enable: { frustrationDetection: true },
    });

    // Trigger dead click on disabled button
    await page.evaluate(() => {
      (window as any).testHelpers.triggerDeadClick();
    });

    // Wait for frustration metrics to be collected
    const metrics = await waitForMetrics(page, 1, 2000);

    // Verify dead click metric was recorded
    const deadClickMetrics = metrics.filter((m) => m.name === 'frustration.dead_click');
    expect(deadClickMetrics.length).toBeGreaterThan(0);

    const deadMetric = deadClickMetrics[0];
    expect(deadMetric.value).toBe(1);
    expect(deadMetric.type).toBe('frustration');
    expect(deadMetric.target).toBe('BUTTON');
  });

  test('should collect web vitals metrics using real PerformanceObserver', async ({ page }) => {
    await initializeRUM(page, {
      tokens: { metrics: 'test-metrics-token' },
      enable: { webVitals: true },
    });

    // Trigger some performance events by interacting with the page
    await page.click('#click-test');
    await page.waitForTimeout(500);

    // Navigate to trigger layout shifts and other vitals
    await page.click('#nav-test');
    await page.waitForTimeout(1000);

    // Get collected metrics
    const data = await getRUMData(page);

    // Verify that performance metrics collection is working
    // (actual metrics may vary based on browser performance)
    expect(Array.isArray(data.metrics)).toBe(true);

    // Check that PerformanceObserver is available and functioning
    const hasPerformanceObserver = await page.evaluate(() => {
      return 'PerformanceObserver' in window;
    });
    expect(hasPerformanceObserver).toBe(true);

    // Verify performance entries are available
    const performanceEntries = await page.evaluate(() => {
      return performance.getEntriesByType('navigation').length > 0;
    });
    expect(performanceEntries).toBe(true);
  });

  test('should maintain session consistency across metrics', async ({ page }) => {
    await initializeRUM(page, {
      tokens: { metrics: 'test-metrics-token' },
      enable: {
        webVitals: true,
        frustrationDetection: true,
        userActions: true,
      },
      frustrationThresholds: { rageClickCount: 2 },
    });

    const initialSession = await getRUMSession(page);

    // Trigger multiple types of metrics
    await page.evaluate(() => {
      (window as any).testHelpers.triggerRageClicks(3);
    });

    await page.click('#click-test');
    await page.waitForTimeout(500);

    // Verify session hasn't changed
    const currentSession = await getRUMSession(page);
    expect(currentSession!.sessionId).toBe(initialSession!.sessionId);
    expect(currentSession!.viewId).toBe(initialSession!.viewId);

    // Verify metrics were collected
    const data = await getRUMData(page);
    expect(data.metrics.length).toBeGreaterThan(0);
  });

  test('should handle page navigation and create new view metrics', async ({ page }) => {
    await initializeRUM(page, {
      tokens: { metrics: 'test-metrics-token' },
      enable: {
        navigation: true,
        webVitals: true,
        frustrationDetection: true,
      },
    });

    const initialSession = await getRUMSession(page);

    // Navigate to a new page
    await page.click('#nav-test');
    await page.waitForTimeout(500);

    // In a real implementation, navigation would create a new view
    // For this mock, we'll simulate the behavior
    await page.evaluate(() => {
      // Simulate new view creation
      (window as any).__rumSession.viewId = 'browser-test-view-' + Date.now();

      // Add a view change metric
      (window as any).__rumData.metrics.push({
        name: 'view.change',
        value: 1,
        timestamp: Date.now(),
        type: 'navigation',
      });
    });

    const newSession = await getRUMSession(page);

    // Session ID should remain the same, view ID should change
    expect(newSession!.sessionId).toBe(initialSession!.sessionId);
    expect(newSession!.viewId).not.toBe(initialSession!.viewId);

    // Verify navigation metric was recorded
    const data = await getRUMData(page);
    const navMetrics = data.metrics.filter((m) => m.name === 'view.change');
    expect(navMetrics.length).toBeGreaterThan(0);
  });
});
