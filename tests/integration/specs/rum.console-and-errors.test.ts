import { startCollector } from '../collector/server';
import { CollectorInstance, SignalKind } from '../collector/types';
import { decodeLogs, extractLogs, extractResourceAttributes } from '../collector/decoders';
import { startRUM, stopRUM, forceFlush } from '../helpers/rumHarness';
import { emitConsole, emitError } from '../helpers/userActions';
import { waitForRequests, sleep } from '../helpers/wait';
import {
  assertEnvironmentAttributes,
  assertLogzioAttributes,
  assertConsoleLog,
  assertSessionAndViewIds,
  getAllLogsFromRequests,
} from '../helpers/verifiers';

describe('RUM Console and Errors Integration', () => {
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

  it('should capture and export console logs', async () => {
    startRUM(collector.port, {
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
    await sleep(500);

    // Emit console log
    const testMessage = 'Integration test console message';
    emitConsole(testMessage);

    // Wait for processing
    await sleep(200);

    // Force flush
    forceFlush();
    await waitForRequests(collector, SignalKind.LOGS, 1, 5000);

    // Verify logs request
    expect(collector.received.logs.length).toBeGreaterThan(0);
    expect(collector.received.logs[0].path).toBe('/logs');
    expect(collector.received.logs[0].method).toBe('POST');

    // Decode logs
    const decoded = decodeLogs(collector.received.logs[0].body);
    const resourceAttributes = extractResourceAttributes(decoded);
    const logRecords = extractLogs(decoded);

    // Verify
    assertEnvironmentAttributes(resourceAttributes);
    assertLogzioAttributes(resourceAttributes);
    assertConsoleLog(logRecords, testMessage);
  });

  it('should capture and export error events', async () => {
    startRUM(collector.port, {
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
    await sleep(500);

    // Emit error event
    const errorMessage = 'Integration test error';
    emitError(errorMessage);

    // Wait for processing
    await sleep(200);

    // Force flush
    forceFlush();
    await waitForRequests(collector, SignalKind.LOGS, 1, 5000);

    // Verify error was captured
    const allLogs = getAllLogsFromRequests(collector.received.logs);

    // Look for error-related log
    const errorLog = allLogs.find(
      (log) => log.body?.stringValue?.includes(errorMessage) || log.severityText === 'ERROR',
    );

    expect(errorLog).toBeDefined();

    if (errorLog?.attributes) {
      expect(errorLog.attributes).toHaveProperty('logzio.session_id');
      expect(errorLog.attributes).toHaveProperty('logzio.view_id');
    }
  });

  it('should capture both console logs and errors together', async () => {
    startRUM(collector.port, {
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
    await sleep(500);

    // Emit both console log and error
    const consoleMessage = 'Test console log';
    const errorMessage = 'Test error message';

    emitConsole(consoleMessage);
    await sleep(100);
    emitError(errorMessage);

    // Wait for processing
    await sleep(300);

    // Force flush
    forceFlush();
    await waitForRequests(collector, SignalKind.LOGS, 1, 5000);

    // Get all logs
    const allLogs = getAllLogsFromRequests(collector.received.logs);

    // Should have both console and error logs
    expect(allLogs.length).toBeGreaterThan(1);
    assertConsoleLog(allLogs, consoleMessage);
    const errorLog = allLogs.find(
      (log) => log.body?.stringValue?.includes(errorMessage) || log.severityText === 'ERROR',
    );
    expect(errorLog).toBeDefined();
  });

  it('should include session and view context in all logs', async () => {
    startRUM(collector.port, {
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
    await sleep(500);

    // Generate multiple logs
    emitConsole('Log message 1');
    await sleep(50);
    emitConsole('Log message 2');
    await sleep(50);
    emitError('Error message');

    // Wait for processing
    await sleep(300);

    // Force flush
    forceFlush();
    await waitForRequests(collector, SignalKind.LOGS, 1, 5000);

    // Get all logs
    const allLogs = getAllLogsFromRequests(collector.received.logs);

    // Verify all logs have session and view context
    for (const log of allLogs) {
      if (log.attributes) {
        assertSessionAndViewIds(log.attributes);
      }
    }
  });

  it('should handle log export failures gracefully', async () => {
    // Set server to return 500 for logs
    collector.setStatus(SignalKind.LOGS, 500);

    startRUM(collector.port, {
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

    // Wait for setup
    await sleep(500);

    // Emit console log
    emitConsole('Test message for 500 error');

    // Wait and flush
    await sleep(200);
    forceFlush();

    // Should still attempt to send logs despite 500 response
    await waitForRequests(collector, SignalKind.LOGS, 1, 5000);

    // Verify request was attempted
    expect(collector.received.logs.length).toBeGreaterThan(0);
    expect(collector.received.logs[0].path).toBe('/logs');
  });
});
