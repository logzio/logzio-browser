import {
  decodeTraces,
  decodeLogs,
  decodeMetrics,
  extractSpans,
  extractLogs,
  getMetricsData,
  Span,
  LogRecord,
} from '../collector/decoders';
import { RecordedReq } from '../collector/types';
import {
  LOGZIO_REGION_HEADER,
  LOGZIO_TRACES_TOKEN_HEADER,
  LOGZIO_LOGS_TOKEN_HEADER,
  LOGZIO_METRICS_TOKEN_HEADER,
} from '@src/openTelemetry/providers/constants';

export function getPageViewSpan(
  spans: Span[],
  options: { viewId?: string } = {},
): Span | undefined {
  return spans.find((span) => {
    const isPageView = span.name === 'Navigation' || span.name.includes('navigation');
    const hasCorrectViewId =
      !options.viewId || span.attributes['logzio.view_id'] === options.viewId;
    return isPageView && hasCorrectViewId;
  });
}

export function buildParentMap(spans: Span[]): Map<string, string> {
  const parentMap = new Map<string, string>();

  for (const span of spans) {
    if (span.parentSpanId) {
      parentMap.set(span.spanId, span.parentSpanId);
    }
  }

  return parentMap;
}

export function assertDirectParent(childSpan: Span, expectedParentSpan: Span): void {
  expect(childSpan.parentSpanId).toBe(expectedParentSpan.spanId);
}

export function assertHasAncestor(
  childSpan: Span,
  expectedAncestorSpan: Span,
  parentMap: Map<string, string>,
): void {
  let currentSpanId: string | undefined = childSpan.spanId;
  const visited = new Set<string>();

  while (currentSpanId && !visited.has(currentSpanId)) {
    visited.add(currentSpanId);

    if (currentSpanId === expectedAncestorSpan.spanId) {
      return; // Found ancestor
    }

    currentSpanId = parentMap.get(currentSpanId);
  }

  throw new Error(
    `Span ${childSpan.name} (${childSpan.spanId}) is not a descendant of ${expectedAncestorSpan.name} (${expectedAncestorSpan.spanId})`,
  );
}

export function assertRequiredAttributes(
  attributes: Record<string, any>,
  required: string[],
): void {
  for (const attr of required) {
    // Use more basic assertions to avoid Jest issues
    if (!(attr in attributes)) {
      console.error(`Missing attribute: ${attr}. Available attributes:`, Object.keys(attributes));
      console.error(`Full attributes object:`, attributes);
      throw new Error(`Missing required attribute: ${attr}`);
    }

    if (attributes[attr] === undefined || attributes[attr] === null) {
      throw new Error(`Attribute ${attr} is undefined or null`);
    }

    if (attributes[attr] === '') {
      throw new Error(`Attribute ${attr} is empty string`);
    }
  }
}

export function assertEnvironmentAttributes(resourceAttributes: Record<string, any>): void {
  const expectedEnvAttrs = [
    'os.name',
    'browser.name',
    'browser.version',
    'device.type',
    // Note: os.version is not always available (e.g., not for macOS in current implementation)
  ];

  assertRequiredAttributes(resourceAttributes, expectedEnvAttrs);
}

export function assertLogzioHeaders(
  headers: Record<string, string>,
  expected: { region: string; tracesToken?: string; logsToken?: string; metricsToken?: string },
): void {
  // Node lowercases header names
  const h = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)]),
  ) as Record<string, string>;

  const REGION = LOGZIO_REGION_HEADER.toLowerCase();
  const TRACES = LOGZIO_TRACES_TOKEN_HEADER.toLowerCase();
  const LOGS = LOGZIO_LOGS_TOKEN_HEADER.toLowerCase();
  const METRICS = LOGZIO_METRICS_TOKEN_HEADER.toLowerCase();

  if (expected.region) expect(h[REGION]).toBe(expected.region);
  if (expected.tracesToken) expect(h[TRACES]).toBe(expected.tracesToken);
  if (expected.logsToken) expect(h[LOGS]).toBe(expected.logsToken);
  if (expected.metricsToken) expect(h[METRICS]).toBe(expected.metricsToken);
}

export function assertSessionAndViewIds(attributes: Record<string, any>): void {
  assertRequiredAttributes(attributes, ['session.id', 'view.id']);
}

export function getSpansByName(spans: Span[], name: string): Span[] {
  return spans.filter((span) => span.name === name || span.name.includes(name));
}

export function getSpansWithAttribute(spans: Span[], attributeKey: string): Span[] {
  return spans.filter((span) => span.attributes[attributeKey] !== undefined);
}

export function assertFrustrationAttributes(span: Span, expectedType: string): void {
  expect(span.attributes).toHaveProperty('logzio.frustration_type');
  expect(span.attributes['logzio.frustration_type']).toBe(expectedType);

  if (expectedType === 'heavy_load') {
    expect(span.attributes).toHaveProperty('frustration.load_duration_ms');
    expect(typeof span.attributes['frustration.load_duration_ms']).toBe('number');
  }
}

export function assertViewEndLog(logs: LogRecord[], expectedUrl: string): void {
  const viewEndLog = logs.find(
    (log) => log.attributes && log.attributes['event_type'] === 'view_end',
  );

  expect(viewEndLog).toBeDefined();
  expect(viewEndLog!.attributes).toHaveProperty('http.url', expectedUrl);
  expect(viewEndLog!.attributes).toHaveProperty('duration');
  assertSessionAndViewIds(viewEndLog!.attributes!);
}

export function assertFrustrationMetrics(metricsRequests: RecordedReq[]): void {
  expect(metricsRequests.length).toBeGreaterThan(0);

  const decodedMetrics = decodeMetrics(metricsRequests[metricsRequests.length - 1].body);
  const metricsData = getMetricsData(decodedMetrics);

  const frustrationMetric = metricsData.find((m) => m.name === 'frustration.count');
  expect(frustrationMetric).toBeDefined();
  expect(frustrationMetric!.points.length).toBeGreaterThan(0);

  // Check that frustration metric has required attributes
  for (const point of frustrationMetric!.points) {
    assertRequiredAttributes(point.attributes, [
      'logzio.frustration_type',
      'logzio.session_id',
      'logzio.view_id',
    ]);
  }
}

export function assertNetworkSpan(spans: Span[], url: string, method: string = 'GET'): Span {
  const networkSpan = spans.find(
    (span) => span.attributes['http.url'] === url && span.attributes['http.method'] === method,
  );

  expect(networkSpan).toBeDefined();
  assertRequiredAttributes(networkSpan!.attributes, [
    'http.url',
    'http.method',
    'logzio.session_id',
    'logzio.view_id',
  ]);

  return networkSpan!;
}

export function assertConsoleLog(logs: LogRecord[], expectedMessage: string): void {
  const consoleLog = logs.find((log) => log.body?.stringValue?.includes(expectedMessage));

  expect(consoleLog).toBeDefined();
  assertSessionAndViewIds(consoleLog!.attributes!);
}

export function getAllSpansFromRequests(tracesRequests: RecordedReq[]): Span[] {
  const allSpans: Span[] = [];

  for (const request of tracesRequests) {
    const decoded = decodeTraces(request.body);
    const spans = extractSpans(decoded);
    allSpans.push(...spans);
  }

  return allSpans;
}

export function getAllLogsFromRequests(logsRequests: RecordedReq[]): LogRecord[] {
  const allLogs: LogRecord[] = [];

  for (const request of logsRequests) {
    const decoded = decodeLogs(request.body);
    const logs = extractLogs(decoded);
    allLogs.push(...logs);
  }

  return allLogs;
}
