import { startCollector } from '../collector/server';
import { CollectorInstance, SignalKind } from '../collector/types';
import { startRUM, stopRUM, forceFlush } from '../helpers/rumHarness';
import { click, rageClick, deadClick } from '../helpers/userActions';
import { waitForRequests, sleep } from '../helpers/wait';
import {
  getPageViewSpan,
  buildParentMap,
  assertDirectParent,
  assertHasAncestor,
  getSpansByName,
  getSpansWithAttribute,
  assertFrustrationAttributes,
  getAllSpansFromRequests,
} from '../helpers/verifiers';

describe('RUM User Interactions Integration', () => {
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

  it('should create click spans under PageView parent', async () => {
    startRUM(collector.port, {
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

    // Wait for initial setup and PageView span
    await sleep(500);

    // Perform click action
    const button = click();

    // Force flush to ensure data is sent
    forceFlush();
    await waitForRequests(collector, SignalKind.TRACES, 1, 5000);

    const allSpans = getAllSpansFromRequests(collector.received.traces);
    const pageViewSpan = getPageViewSpan(allSpans);
    expect(pageViewSpan).toBeDefined();

    // Find click-related spans
    const clickSpans = getSpansByName(allSpans, 'click');
    expect(clickSpans.length).toBeGreaterThan(0);

    // Verify click span parentage
    const parentMap = buildParentMap(allSpans);
    for (const clickSpan of clickSpans) {
      // Prefer direct parent, but accept ancestor if there are intermediate spans
      try {
        assertDirectParent(clickSpan, pageViewSpan!);
      } catch {
        // Fallback to ancestor check
        assertHasAncestor(clickSpan, pageViewSpan!, parentMap);
      }
    }

    // Clean up button
    if (button.parentNode) {
      button.parentNode.removeChild(button);
    }
  });

  it('should detect rage clicks and add frustration attributes', async () => {
    startRUM(collector.port, {
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
        heavyLoadThresholdMs: 2000,
      },
    });

    // Wait for initial setup
    await sleep(500);

    // Perform rage click sequence
    const button = rageClick(undefined, 4);

    // Wait for all clicks to be processed
    await sleep(300);

    // Force flush
    forceFlush();
    await waitForRequests(collector, SignalKind.TRACES, 1, 5000);

    const allSpans = getAllSpansFromRequests(collector.received.traces);
    const frustrationSpans = getSpansWithAttribute(allSpans, 'logzio.frustration_type');
    expect(frustrationSpans.length).toBeGreaterThan(0);

    // Verify frustration attributes
    const rageSpan = frustrationSpans.find(
      (span) => span.attributes['logzio.frustration_type'] === 'rage_click',
    );
    expect(rageSpan).toBeDefined();
    assertFrustrationAttributes(rageSpan!, 'rage_click');

    // Clean up button
    if (button.parentNode) {
      button.parentNode.removeChild(button);
    }
  });

  it('should create click span for disabled element (dead click scenario)', async () => {
    startRUM(collector.port, {
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
    await sleep(500);

    // Perform dead click
    const deadButton = deadClick();

    // Wait for processing
    await sleep(200);

    // Force flush
    forceFlush();
    await waitForRequests(collector, SignalKind.TRACES, 1, 5000);

    // Get all spans
    const allSpans = getAllSpansFromRequests(collector.received.traces);

    const clickSpans = getSpansByName(allSpans, 'click');
    expect(clickSpans.length).toBeGreaterThan(0);
    expect((deadButton as HTMLButtonElement).disabled).toBe(true);

    // Clean up button
    if (deadButton.parentNode) {
      deadButton.parentNode.removeChild(deadButton);
    }
  });
});
