import { startCollector } from '../collector/server';
import { CollectorInstance, SignalKind } from '../collector/types';
import { decodeTraces, extractSpans, extractResourceAttributes } from '../collector/decoders';
import { startRUM, stopRUM, forceFlush } from '../helpers/rumHarness';
import { fireDocumentLoad } from '../helpers/userActions';
import { waitForRequests } from '../helpers/wait';
import {
  assertEnvironmentAttributes,
  assertLogzioHeaders,
  assertSessionAndViewIds,
} from '../helpers/verifiers';

describe('RUM Basic Integration', () => {
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

  it('should initialize and export traces on document load', async () => {
    // Start RUM with minimal config
    startRUM(collector.port, {
      enable: {
        documentLoad: true,
        userActions: false,
        resourceLoad: false,
        consoleLogs: false,
        errorTracking: false,
        webVitals: false,
        viewEvents: false,
        navigation: true,
        frustrationDetection: false,
      },
    });

    // Trigger document load
    fireDocumentLoad();

    // Force flush to ensure data is sent
    forceFlush();
    await waitForRequests(collector, SignalKind.TRACES, 1, 10000);

    // Verify request was made to correct endpoint
    expect(collector.received.traces.length).toBeGreaterThanOrEqual(1);
    expect(collector.received.traces[0].path).toBe('/traces');
    expect(collector.received.traces[0].method).toBe('POST');
    expect(collector.received.traces[0].body.length).toBeGreaterThan(0);

    // Decode and verify traces content
    const decoded = decodeTraces(collector.received.traces[0].body);
    const spans = extractSpans(decoded);
    const resourceAttributes = extractResourceAttributes(decoded);

    expect(spans.length).toBeGreaterThan(0);
    assertEnvironmentAttributes(resourceAttributes);
    assertLogzioHeaders(collector.received.traces[0].headers, {
      region: 'us-east-1',
      tracesToken: 'test-traces-token',
    });
    for (const span of spans) {
      assertSessionAndViewIds(span.attributes);
    }

    const pageViewSpan = spans.find(
      (span) => span.name === 'Navigation' || span.name.includes('navigation'),
    );
    expect(pageViewSpan).toBeDefined();
    expect(pageViewSpan!.attributes['http.url']).toBe('http://127.0.0.1/');
  });

  it('should handle initialization gracefully when server returns 500', async () => {
    // Set server to return 500 for traces
    collector.setStatus(SignalKind.TRACES, 500);

    // Should not throw during initialization
    expect(() => {
      startRUM(collector.port, {
        enable: {
          documentLoad: true,
          userActions: false,
          resourceLoad: false,
          consoleLogs: false,
          errorTracking: false,
          webVitals: false,
          viewEvents: false,
          navigation: true,
          frustrationDetection: false,
        },
      });
    }).not.toThrow();

    // Trigger document load
    fireDocumentLoad();
    forceFlush();

    // Wait for failed request attempts
    await waitForRequests(collector, SignalKind.TRACES, 1, 5000);

    // Verify request was attempted despite 500 response
    expect(collector.received.traces.length).toBeGreaterThanOrEqual(1);
    expect(collector.received.traces[0].path).toBe('/traces');
  });
});
