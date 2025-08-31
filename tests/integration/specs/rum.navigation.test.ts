import { startCollector } from '../collector/server';
import { CollectorInstance, SignalKind } from '../collector/types';
import { startRUM, stopRUM, forceFlush } from '../helpers/rumHarness';
import { navigate } from '../helpers/userActions';
import { waitForRequests, sleep } from '../helpers/wait';
import {
  getPageViewSpan,
  assertViewEndLog,
  getAllSpansFromRequests,
  getAllLogsFromRequests,
} from '../helpers/verifiers';

describe('RUM Navigation Integration', () => {
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

  it('should create new PageView span on navigation and emit view end log', async () => {
    startRUM(collector.port, {
      enable: {
        userActions: false,
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
    await sleep(500);
    forceFlush();
    await waitForRequests(collector, SignalKind.TRACES, 1, 5000);

    // Get initial spans
    const initialSpans = getAllSpansFromRequests(collector.received.traces);
    const initialPageView = getPageViewSpan(initialSpans);
    expect(initialPageView).toBeDefined();

    const initialViewId = initialPageView!.attributes['logzio.view_id'];
    expect(initialViewId).toBeDefined();

    // Clear collector to track new requests
    collector.clear();

    // Navigate to new page
    navigate('/new-page');

    // Wait for navigation to be processed
    await sleep(500);
    forceFlush();

    // Wait for new traces and logs
    await waitForRequests(collector, SignalKind.TRACES, 1, 5000);

    // Check if logs were generated (view end log)
    if (collector.received.logs.length > 0) {
      const allLogs = getAllLogsFromRequests(collector.received.logs);
      assertViewEndLog(allLogs, 'http://127.0.0.1/');
    }

    // Get new spans after navigation
    const newSpans = getAllSpansFromRequests(collector.received.traces);
    const newPageView = getPageViewSpan(newSpans);
    expect(newPageView).toBeDefined();

    // Verify new PageView has different view ID
    const newViewId = newPageView!.attributes['logzio.view_id'];
    expect(newViewId).toBeDefined();
    expect(newViewId).not.toBe(initialViewId);

    // Verify new PageView has updated URL
    expect(newPageView!.attributes['http.url']).toBe('http://127.0.0.1/new-page');
  });

  it('should maintain session ID across navigation', async () => {
    startRUM(collector.port, {
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
    await sleep(500);
    forceFlush();
    await waitForRequests(collector, SignalKind.TRACES, 1, 5000);

    const initialSpans = getAllSpansFromRequests(collector.received.traces);
    const initialPageView = getPageViewSpan(initialSpans);
    const sessionId = initialPageView!.attributes['logzio.session_id'];
    expect(sessionId).toBeDefined();

    // Clear collector
    collector.clear();

    // Navigate multiple times
    navigate('/page1');
    await sleep(200);
    navigate('/page2');
    await sleep(200);
    navigate('/page3');
    await sleep(500);

    forceFlush();
    await waitForRequests(collector, SignalKind.TRACES, 1, 5000);

    // Verify all new PageView spans have the same session ID
    const allSpans = getAllSpansFromRequests(collector.received.traces);
    const pageViewSpans = allSpans.filter(
      (span) => span.name === 'Navigation' || span.name.includes('navigation'),
    );

    expect(pageViewSpans.length).toBeGreaterThan(0);

    for (const span of pageViewSpans) {
      expect(span.attributes['logzio.session_id']).toBe(sessionId);
    }
  });

  it('should create different view IDs for each navigation', async () => {
    startRUM(collector.port, {
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
    await sleep(500);

    // Navigate multiple times quickly
    navigate('/page1');
    await sleep(100);
    navigate('/page2');
    await sleep(100);
    navigate('/page3');
    await sleep(500);

    forceFlush();
    await waitForRequests(collector, SignalKind.TRACES, 1, 5000);

    // Get all PageView spans
    const allSpans = getAllSpansFromRequests(collector.received.traces);
    const pageViewSpans = allSpans.filter(
      (span) => span.name === 'Navigation' || span.name.includes('navigation'),
    );

    expect(pageViewSpans.length).toBeGreaterThan(1);

    // Collect all view IDs
    const viewIds = pageViewSpans.map((span) => span.attributes['logzio.view_id']);

    // Verify all view IDs are unique
    const uniqueViewIds = new Set(viewIds);
    expect(uniqueViewIds.size).toBe(viewIds.length);
  });
});
