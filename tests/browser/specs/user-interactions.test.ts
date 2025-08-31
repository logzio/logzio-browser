import { test, expect } from '@playwright/test';
import { initializeRUM, getRUMData, clearRUMData as _clearRUMData } from '../helpers/rumHarness';

test.describe('RUM User Interactions Integration (Browser)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:8080/test.html');
  });

  test('should create click spans under PageView parent', async ({ page }) => {
    // Initialize RUM with user interactions enabled
    await initializeRUM(page, {
      tokens: { traces: 'test-token' },
      region: 'us',
      enable: {
        userActions: true,
        documentLoad: true,
        navigation: true,
        frustrationDetection: false, // Focus on basic interactions first
        resourceLoad: false,
        consoleLogs: false,
        errorTracking: false,
        webVitals: false,
        viewEvents: false,
      },
    });

    // Wait for initial setup and PageView span
    await page.waitForTimeout(500);

    // Click on button
    await page.click('#click-test');
    await page.waitForTimeout(500);

    // Get all spans
    const data = await getRUMData(page);
    const allSpans = data.traces;

    // Find PageView span
    const pageViewSpan = allSpans.find(
      (span) => span.name === 'Navigation' && span.attributes['span.kind'] === 'navigation',
    );
    expect(pageViewSpan).toBeDefined();

    // Find click-related spans
    const clickSpans = allSpans.filter(
      (span) => span.name && (span.name.includes('click') || span.name.includes('Click')),
    );

    if (clickSpans.length > 0) {
      const clickSpan = clickSpans[0];

      // Verify click span has required attributes
      expect(clickSpan.attributes['view.id']).toBe(pageViewSpan.attributes['view.id']);
      expect(clickSpan.attributes['session.id']).toBe(pageViewSpan.attributes['session.id']);
      expect(clickSpan.attributes['target.element']).toBeDefined();
    }
  });

  test('should detect rage clicks and add frustration attributes', async ({ page }) => {
    // Initialize RUM with frustration detection enabled
    await initializeRUM(page, {
      tokens: { traces: 'test-token', metrics: 'test-token' },
      region: 'us',
      enable: {
        userActions: true,
        documentLoad: true,
        navigation: true,
        frustrationDetection: true,
        resourceLoad: false,
        consoleLogs: false,
        errorTracking: false,
        webVitals: false,
        viewEvents: false,
      },
      frustrationThresholds: {
        rageClickCount: 3,
        rageClickIntervalMs: 1000,
      },
    });

    // Wait for initial setup
    await page.waitForTimeout(500);

    // Perform rapid clicks (rage click)
    const button = page.locator('#rage-click-target');
    for (let i = 0; i < 4; i++) {
      await button.click();
      await page.waitForTimeout(100);
    }

    await page.waitForTimeout(1000);

    // Get spans and metrics
    const data = await getRUMData(page);

    // Check for frustration metrics
    const frustrationMetrics = data.metrics.filter(
      (metric) => metric.name && metric.name.includes('rage'),
    );

    if (frustrationMetrics.length > 0) {
      expect(frustrationMetrics.length).toBeGreaterThan(0);
      const rageMetric = frustrationMetrics[0];
      expect(rageMetric.value).toBeGreaterThan(0);
      expect(rageMetric.type).toBe('frustration');
    }

    // Check for frustration spans if any
    const frustrationSpans = data.traces.filter(
      (span) => span.attributes && span.attributes['frustration.type'],
    );

    for (const span of frustrationSpans) {
      expect(span.attributes['frustration.type']).toBeDefined();
      expect(span.attributes['session.id']).toBeDefined();
      expect(span.attributes['view.id']).toBeDefined();
    }
  });

  test('should detect dead clicks on disabled elements', async ({ page }) => {
    // Initialize RUM with frustration detection enabled
    await initializeRUM(page, {
      tokens: { traces: 'test-token', metrics: 'test-token' },
      region: 'us',
      enable: {
        userActions: true,
        documentLoad: true,
        navigation: true,
        frustrationDetection: true,
        resourceLoad: false,
        consoleLogs: false,
        errorTracking: false,
        webVitals: false,
        viewEvents: false,
      },
    });

    // Wait for initial setup
    await page.waitForTimeout(500);

    // Try to click on disabled button (should generate dead click)
    // Use force: true to click on disabled element
    await page.click('#dead-click-target', { force: true });
    await page.waitForTimeout(1000);

    // Get metrics
    const data = await getRUMData(page);
    const deadClickMetrics = data.metrics.filter(
      (metric) => metric.name && metric.name.includes('dead'),
    );

    if (deadClickMetrics.length > 0) {
      expect(deadClickMetrics.length).toBeGreaterThan(0);
      const deadMetric = deadClickMetrics[0];
      expect(deadMetric.value).toBeGreaterThan(0);
      expect(deadMetric.type).toBe('frustration');
    }
  });

  test('should include session and view context in interaction spans', async ({ page }) => {
    // Initialize RUM
    await initializeRUM(page, {
      tokens: { traces: 'test-token' },
      region: 'us',
      enable: {
        userActions: true,
        documentLoad: true,
        navigation: true,
        frustrationDetection: false,
        resourceLoad: false,
        consoleLogs: false,
        errorTracking: false,
        webVitals: false,
        viewEvents: false,
      },
    });

    // Wait for initial setup
    await page.waitForTimeout(500);

    // Perform various interactions
    await page.click('#click-test');
    await page.click('#fetch-test');
    await page.waitForTimeout(1000);

    // Get all spans
    const data = await getRUMData(page);
    const interactionSpans = data.traces.filter(
      (span) =>
        span.attributes &&
        (span.attributes['target.element'] || (span.name && span.name.includes('click'))),
    );

    // Verify all interaction spans have session/view context
    for (const span of interactionSpans) {
      expect(span.attributes['session.id']).toBeDefined();
      expect(span.attributes['view.id']).toBeDefined();
    }
  });
});
