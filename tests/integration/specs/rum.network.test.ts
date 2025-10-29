import { startCollector } from '../collector/server';
import { CollectorInstance, SignalKind } from '../collector/types';
import { startRUM, stopRUM, forceFlush } from '../helpers/rumHarness';
import { triggerFetch, triggerXHR } from '../helpers/userActions';
import { waitForRequests, sleep } from '../helpers/wait';
import {
  getPageViewSpan,
  buildParentMap,
  assertHasAncestor,
  assertNetworkSpan,
  getAllSpansFromRequests,
} from '../helpers/verifiers';

describe('RUM Network Integration', () => {
  let collector: CollectorInstance;

  beforeAll(async () => {
    collector = await startCollector();
  });

  afterAll(async () => {
    await collector.stop();
  });

  afterEach(() => {
    stopRUM();
    collector.clear();
  });

  it('should create fetch spans under PageView parent', async () => {
    startRUM(collector.port, {
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
    await sleep(500);

    // Trigger fetch to the echo endpoint
    const echoUrl = `http://127.0.0.1:${collector.port}/echo`;

    try {
      await triggerFetch(echoUrl);
    } catch (_error) {
      // Network errors are expected in test environment
    }

    // Wait for processing
    await sleep(500);
    forceFlush();
    await waitForRequests(collector, SignalKind.TRACES, 1, 5000);

    const allSpans = getAllSpansFromRequests(collector.received.traces);
    const pageViewSpan = getPageViewSpan(allSpans);
    expect(pageViewSpan).toBeDefined();

    const fetchSpan = assertNetworkSpan(allSpans, echoUrl, 'GET');
    const parentMap = buildParentMap(allSpans);
    assertHasAncestor(fetchSpan, pageViewSpan!, parentMap);
  });

  it('should create XMLHttpRequest spans under PageView parent', async () => {
    startRUM(collector.port, {
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
    await sleep(500);

    // Trigger XHR to the echo endpoint
    const echoUrl = `http://127.0.0.1:${collector.port}/echo`;

    try {
      await triggerXHR(echoUrl);
    } catch (_error) {
      // Network errors are expected in test environment
    }

    // Wait for processing
    await sleep(500);
    forceFlush();
    await waitForRequests(collector, SignalKind.TRACES, 1, 5000);

    const allSpans = getAllSpansFromRequests(collector.received.traces);
    const pageViewSpan = getPageViewSpan(allSpans);
    expect(pageViewSpan).toBeDefined();

    const xhrSpan = assertNetworkSpan(allSpans, echoUrl, 'GET');
    const parentMap = buildParentMap(allSpans);
    assertHasAncestor(xhrSpan, pageViewSpan!, parentMap);
  });

  it('should capture different HTTP methods correctly', async () => {
    startRUM(collector.port, {
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
    await sleep(500);

    const echoUrl = `http://127.0.0.1:${collector.port}/echo`;

    // Test POST request with fetch
    try {
      await fetch(echoUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' }),
      });
    } catch (_error) {
      // Expected in test environment
    }

    // Wait for processing
    await sleep(500);
    forceFlush();
    await waitForRequests(collector, SignalKind.TRACES, 1, 5000);

    const allSpans = getAllSpansFromRequests(collector.received.traces);
    const postSpan = assertNetworkSpan(allSpans, echoUrl, 'POST');
    expect(postSpan.attributes['http.method']).toBe('POST');
  });

  it('should handle network errors gracefully', async () => {
    startRUM(collector.port, {
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
    await sleep(500);

    // Trigger request to non-existent endpoint
    const invalidUrl = 'http://127.0.0.1:99999/invalid';

    try {
      await triggerFetch(invalidUrl);
    } catch (_error) {
      // Expected network error
    }

    // Wait for processing
    await sleep(500);
    forceFlush();
    await waitForRequests(collector, SignalKind.TRACES, 1, 5000);

    // Verify we still get spans despite network errors
    const allSpans = getAllSpansFromRequests(collector.received.traces);
    expect(allSpans.length).toBeGreaterThan(0);

    // Should have PageView span at minimum
    const pageViewSpan = getPageViewSpan(allSpans);
    expect(pageViewSpan).toBeDefined();
  });
});
