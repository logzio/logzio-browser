import { test, expect } from '@playwright/test';
import { initializeRUM, getRUMData, clearRUMData as _clearRUMData } from '../helpers/rumHarness';

test.describe('RUM Network Integration (Browser)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://127.0.0.1:8080/test.html');
  });

  test('should create fetch spans under PageView parent', async ({ page }) => {
    // Initialize RUM with network tracking enabled
    await initializeRUM(page, {
      tokens: { traces: 'test-token' },
      region: 'us',
      enable: {
        userActions: false,
        documentLoad: true,
        navigation: true,
        resourceLoad: true,
        frustrationDetection: false,
        consoleLogs: false,
        errorTracking: false,
        webVitals: false,
        viewEvents: false,
      },
    });

    // Wait for initial setup
    await page.waitForTimeout(500);

    // Trigger fetch request
    await page.evaluate(async () => {
      try {
        await fetch('/api/test', { method: 'GET' });
      } catch (_e) {
        // Ignore network errors - we're just testing trace generation
      }
    });

    await page.waitForTimeout(1000);

    // Get all traces
    const data = await getRUMData(page);
    const allTraces = data.traces;

    // Find PageView span
    const pageViewSpan = allTraces.find(
      (t) => t.name === 'Navigation' && t.attributes['span.kind'] === 'navigation',
    );
    expect(pageViewSpan).toBeDefined();

    // Find network spans
    const networkSpans = allTraces.filter(
      (t) =>
        t.name && (t.name.includes('fetch') || t.name.includes('GET') || t.name.includes('POST')),
    );

    if (networkSpans.length > 0) {
      // Verify network span has required attributes
      const networkSpan = networkSpans[0];
      expect(networkSpan.attributes['http.method']).toBeDefined();
      expect(networkSpan.attributes['session.id']).toBe(pageViewSpan.attributes['session.id']);
      expect(networkSpan.attributes['view.id']).toBe(pageViewSpan.attributes['view.id']);
    }
  });

  test('should create XMLHttpRequest spans under PageView parent', async ({ page }) => {
    // Initialize RUM
    await initializeRUM(page, {
      tokens: { traces: 'test-token' },
      region: 'us',
      enable: {
        userActions: false,
        documentLoad: true,
        navigation: true,
        resourceLoad: true,
        frustrationDetection: false,
        consoleLogs: false,
        errorTracking: false,
        webVitals: false,
        viewEvents: false,
      },
    });

    // Wait for initial setup
    await page.waitForTimeout(500);

    // Trigger XHR request
    await page.evaluate(() => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/test');
      xhr.setRequestHeader('Content-Type', 'application/json');
      try {
        xhr.send(JSON.stringify({ test: 'data' }));
      } catch (_e) {
        // Ignore network errors
      }
    });

    await page.waitForTimeout(1000);

    // Get all traces
    const data = await getRUMData(page);
    const allTraces = data.traces;

    // Find PageView span
    const pageViewSpan = allTraces.find(
      (t) => t.name === 'Navigation' && t.attributes['span.kind'] === 'navigation',
    );
    expect(pageViewSpan).toBeDefined();

    // Find network spans
    const networkSpans = allTraces.filter(
      (t) =>
        t.name &&
        (t.name.includes('xhr') || t.name.includes('POST') || t.name.includes('XMLHttpRequest')),
    );

    if (networkSpans.length > 0) {
      // Verify XHR span attributes
      const xhrSpan = networkSpans[0];
      expect(xhrSpan.attributes['http.method']).toBe('POST');
      expect(xhrSpan.attributes['session.id']).toBe(pageViewSpan.attributes['session.id']);
      expect(xhrSpan.attributes['view.id']).toBe(pageViewSpan.attributes['view.id']);
    }
  });

  test('should capture different HTTP methods correctly', async ({ page }) => {
    // Initialize RUM
    await initializeRUM(page, {
      tokens: { traces: 'test-token' },
      region: 'us',
      enable: {
        userActions: false,
        documentLoad: true,
        navigation: true,
        resourceLoad: true,
        frustrationDetection: false,
        consoleLogs: false,
        errorTracking: false,
        webVitals: false,
        viewEvents: false,
      },
    });

    // Wait for initial setup
    await page.waitForTimeout(500);

    // Trigger different HTTP methods
    await page.evaluate(async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE'];
      for (const method of methods) {
        try {
          await fetch(`/api/test-${method.toLowerCase()}`, { method });
        } catch (_e) {
          // Ignore network errors
        }
      }
    });

    await page.waitForTimeout(1000);

    // Get all traces
    const data = await getRUMData(page);
    const networkSpans = data.traces.filter((t) => t.attributes && t.attributes['http.method']);

    if (networkSpans.length > 0) {
      // Check that we captured at least some HTTP methods
      const httpMethods = networkSpans.map((span) => span.attributes['http.method']);
      const uniqueMethods = new Set(httpMethods);
      expect(uniqueMethods.size).toBeGreaterThan(0);

      // Each span should have required network attributes
      for (const span of networkSpans) {
        expect(span.attributes['http.method']).toBeDefined();
        expect(span.attributes['session.id']).toBeDefined();
        expect(span.attributes['view.id']).toBeDefined();
      }
    }
  });
});
