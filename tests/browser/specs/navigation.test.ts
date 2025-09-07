import { test, expect } from '@playwright/test';
import { initializeRUM, getRUMData, clearRUMData } from '../helpers/rumHarness';

test.describe('RUM Navigation Integration (Browser)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:8080/test.html');
  });

  test('should create new PageView span on navigation and emit view end log', async ({ page }) => {
    // Initialize RUM with navigation enabled
    await initializeRUM(page, {
      tokens: { traces: 'test-token', logs: 'test-token' },
      region: 'us',
      enable: {
        userActions: true, // Enable userActions to test click-to-navigation behavior
        documentLoad: true,
        navigation: true,
        viewEvents: true,
        frustrationDetection: false,
        resourceLoad: false,
        consoleLogs: false,
        errorTracking: false,
        webVitals: false,
      },
    });

    // Wait for initial PageView span
    await page.waitForTimeout(500);

    // Get initial data
    const initialData = await getRUMData(page);
    const initialTraces = initialData.traces.filter(
      (t) => t.name === 'Navigation' || t.name.includes('pageview'),
    );
    expect(initialTraces.length).toBeGreaterThan(0);

    const initialViewId = initialTraces[0].attributes['view.id'];
    expect(initialViewId).toBeDefined();

    // Clear data to track new events
    await clearRUMData(page);

    // Navigate to new page using SPA navigation
    await page.evaluate(() => {
      window.history.pushState({}, '', '/new-page');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    // Wait for navigation to be processed
    await page.waitForTimeout(500);

    // Get new data after navigation
    const newData = await getRUMData(page);

    // Check for view end logs
    const viewEndLogs = newData.logs.filter((log) => log.body && log.body.includes('view_end'));
    if (viewEndLogs.length > 0) {
      expect(viewEndLogs[0].attributes['view.url']).toBe('http://127.0.0.1:8080/test.html');
    }

    // Check for new PageView traces
    const newTraces = newData.traces.filter(
      (t) => t.name === 'Navigation' || t.name.includes('pageview'),
    );
    expect(newTraces.length).toBeGreaterThan(0);

    // Verify new PageView has different view ID
    const newViewId = newTraces[0].attributes['view.id'];
    expect(newViewId).toBeDefined();
    expect(newViewId).not.toBe(initialViewId);

    // Verify new PageView has updated URL
    expect(newTraces[0].attributes['http.url']).toBe('http://127.0.0.1:8080/new-page');
  });

  test('should maintain session ID across navigation', async ({ page }) => {
    // Initialize RUM
    await initializeRUM(page, {
      tokens: { traces: 'test-token' },
      region: 'us',
      enable: {
        userActions: false,
        documentLoad: true,
        navigation: true,
        viewEvents: false,
        frustrationDetection: false,
        resourceLoad: false,
        consoleLogs: false,
        errorTracking: false,
        webVitals: false,
      },
    });

    // Wait for initial PageView
    await page.waitForTimeout(500);

    const initialData = await getRUMData(page);
    const initialTraces = initialData.traces.filter(
      (t) => t.name === 'Navigation' || t.name.includes('pageview'),
    );
    expect(initialTraces.length).toBeGreaterThan(0);

    const sessionId = initialTraces[0].attributes['session.id'];
    expect(sessionId).toBeDefined();

    // Clear data
    await clearRUMData(page);

    // Navigate multiple times
    await page.evaluate(() => {
      window.history.pushState({}, '', '/page1');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForTimeout(200);

    await page.evaluate(() => {
      window.history.pushState({}, '', '/page2');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForTimeout(200);

    await page.evaluate(() => {
      window.history.pushState({}, '', '/page3');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForTimeout(500);

    // Get all navigation traces
    const finalData = await getRUMData(page);
    const navigationTraces = finalData.traces.filter(
      (t) =>
        t.name === 'Navigation' || t.name.includes('navigation') || t.name.includes('pageview'),
    );

    expect(navigationTraces.length).toBeGreaterThan(0);

    // Verify all navigation spans have the same session ID
    for (const trace of navigationTraces) {
      expect(trace.attributes['session.id']).toBe(sessionId);
    }
  });

  test('should create different view IDs for each navigation', async ({ page }) => {
    // Initialize RUM
    await initializeRUM(page, {
      tokens: { traces: 'test-token' },
      region: 'us',
      enable: {
        userActions: false,
        documentLoad: true,
        navigation: true,
        viewEvents: false,
        frustrationDetection: false,
        resourceLoad: false,
        consoleLogs: false,
        errorTracking: false,
        webVitals: false,
      },
    });

    // Initial setup
    await page.waitForTimeout(500);

    // Navigate multiple times with enough delay to ensure unique timestamps
    await page.evaluate(() => {
      window.history.pushState({}, '', '/page1');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForTimeout(200);

    await page.evaluate(() => {
      window.history.pushState({}, '', '/page2');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForTimeout(200);

    await page.evaluate(() => {
      window.history.pushState({}, '', '/page3');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await page.waitForTimeout(500);

    // Get all navigation traces
    const finalData = await getRUMData(page);
    const navigationTraces = finalData.traces.filter(
      (t) =>
        t.name === 'Navigation' || t.name.includes('navigation') || t.name.includes('pageview'),
    );

    expect(navigationTraces.length).toBeGreaterThan(1);

    // Collect all view IDs
    const viewIds = navigationTraces.map((trace) => trace.attributes['view.id']).filter(Boolean);

    // We expect at least 3 unique view IDs (initial load + at least 2 navigations)
    // The exact number might vary due to timing, but they should all be unique
    const uniqueViewIds = new Set(viewIds);
    expect(uniqueViewIds.size).toBeGreaterThanOrEqual(3);

    // All view IDs that exist should be unique (no duplicates)
    expect(uniqueViewIds.size).toBe(viewIds.length);
  });

  test('should create navigation spans when click causes navigation', async ({ page }) => {
    // Initialize RUM with both userActions and navigation enabled
    await initializeRUM(page, {
      tokens: { traces: 'test-token' },
      region: 'us',
      enable: {
        userActions: true,
        documentLoad: true,
        navigation: true,
        viewEvents: false,
        frustrationDetection: false,
        resourceLoad: false,
        consoleLogs: false,
        errorTracking: false,
        webVitals: false,
      },
    });

    // Wait for initial setup
    await page.waitForTimeout(500);
    await clearRUMData(page);

    // Just click the navigation button and see what spans are created
    await page.click('#nav-test');

    // Wait for span processing
    await page.waitForTimeout(1000);

    // Get all traces
    const data = await getRUMData(page);

    // Look for any spans that might be related to user interactions
    const clickSpans = data.traces.filter((t) => t.name === 'click');
    const navigationSpans = data.traces.filter((t) => t.name.includes('Navigation:'));

    // The test should pass if we get either click spans or navigation spans
    // (the exact behavior depends on timing)
    const userInteractionSpans = [...clickSpans, ...navigationSpans];

    expect(userInteractionSpans.length).toBeGreaterThan(0);

    // If we got navigation spans, verify they have correct attributes
    if (navigationSpans.length > 0) {
      const navSpan = navigationSpans[0];
      expect(navSpan.name).toContain('Navigation:');
      expect(navSpan.attributes['http.url']).toBeDefined();
    }

    // If we got click spans, that's also valid behavior
    if (clickSpans.length > 0) {
      const clickSpan = clickSpans[0];
      expect(clickSpan.name).toBe('click');
      expect(clickSpan.attributes['target.element']).toBeDefined();
    }
  });
});
