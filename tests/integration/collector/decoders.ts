// Types and interfaces for decoding OTLP payloads

export interface Span {
  name: string;
  spanId: string;
  parentSpanId?: string;
  traceId: string;
  attributes: Record<string, any>;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
}

export interface LogRecord {
  body: { stringValue?: string };
  severityText?: string;
  attributes?: Record<string, any>;
}

export interface MetricPoint {
  attributes: Record<string, any>;
  value?: number;
}

export interface DecodedTraces {
  resourceSpans: Array<{
    resource: { attributes: Array<{ key: string; value: any }> };
    scopeSpans: Array<{
      spans: Span[];
    }>;
  }>;
}

export interface DecodedLogs {
  resourceLogs: Array<{
    resource: { attributes: Array<{ key: string; value: any }> };
    scopeLogs: Array<{
      logRecords: LogRecord[];
    }>;
  }>;
}

export interface DecodedMetrics {
  resourceMetrics: Array<{
    resource: { attributes: Array<{ key: string; value: any }> };
    scopeMetrics: Array<{
      metrics: Array<{
        name: string;
        description?: string;
        sum?: { dataPoints: MetricPoint[] };
        gauge?: { dataPoints: MetricPoint[] };
      }>;
    }>;
  }>;
}

export function decodeTraces(body: Buffer): DecodedTraces {
  try {
    return JSON.parse(body.toString()) as DecodedTraces;
  } catch (error) {
    throw new Error(`Failed to decode traces: ${error}`);
  }
}

export function decodeLogs(body: Buffer): DecodedLogs {
  try {
    return JSON.parse(body.toString()) as DecodedLogs;
  } catch (error) {
    throw new Error(`Failed to decode logs: ${error}`);
  }
}

export function decodeMetrics(body: Buffer): DecodedMetrics {
  try {
    return JSON.parse(body.toString()) as DecodedMetrics;
  } catch (error) {
    throw new Error(`Failed to decode metrics: ${error}`);
  }
}

export function extractSpans(traces: DecodedTraces): Span[] {
  const spans: Span[] = [];

  for (const resourceSpan of traces.resourceSpans) {
    for (const scopeSpan of resourceSpan.scopeSpans) {
      for (const rawSpan of scopeSpan.spans) {
        // Flatten OTLP attributes format
        const attributes: Record<string, any> = {};
        if (rawSpan.attributes && Array.isArray(rawSpan.attributes)) {
          for (const attr of rawSpan.attributes) {
            attributes[attr.key] = attr.value?.stringValue || attr.value?.intValue || attr.value;
          }
        } else if (rawSpan.attributes && typeof rawSpan.attributes === 'object') {
          // Already flattened
          Object.assign(attributes, rawSpan.attributes);
        }

        spans.push({
          ...rawSpan,
          attributes,
        });
      }
    }
  }

  return spans;
}

export function extractLogs(logs: DecodedLogs): LogRecord[] {
  const records: LogRecord[] = [];

  for (const resourceLog of logs.resourceLogs) {
    for (const scopeLog of resourceLog.scopeLogs) {
      for (const rawRecord of scopeLog.logRecords) {
        // Flatten OTLP attributes format like we do for spans
        const attributes: Record<string, any> = {};
        if (rawRecord.attributes && Array.isArray(rawRecord.attributes)) {
          for (const attr of rawRecord.attributes) {
            attributes[attr.key] = attr.value?.stringValue || attr.value?.intValue || attr.value;
          }
        } else if (rawRecord.attributes && typeof rawRecord.attributes === 'object') {
          // Already flattened
          Object.assign(attributes, rawRecord.attributes);
        }

        records.push({
          ...rawRecord,
          attributes,
        });
      }
    }
  }

  return records;
}

export function extractResourceAttributes(
  decoded: DecodedTraces | DecodedLogs | DecodedMetrics,
): Record<string, any> {
  const attributes: Record<string, any> = {};

  if ('resourceSpans' in decoded) {
    const resource = decoded.resourceSpans[0]?.resource;
    if (resource?.attributes) {
      for (const attr of resource.attributes) {
        attributes[attr.key] = attr.value?.stringValue || attr.value?.intValue || attr.value;
      }
    }
  } else if ('resourceLogs' in decoded) {
    const resource = decoded.resourceLogs[0]?.resource;
    if (resource?.attributes) {
      for (const attr of resource.attributes) {
        attributes[attr.key] = attr.value?.stringValue || attr.value?.intValue || attr.value;
      }
    }
  } else if ('resourceMetrics' in decoded) {
    const resource = decoded.resourceMetrics[0]?.resource;
    if (resource?.attributes) {
      for (const attr of resource.attributes) {
        attributes[attr.key] = attr.value?.stringValue || attr.value?.intValue || attr.value;
      }
    }
  }

  return attributes;
}

export function getMetricsData(
  metrics: DecodedMetrics,
): Array<{ name: string; points: MetricPoint[] }> {
  const result: Array<{ name: string; points: MetricPoint[] }> = [];

  for (const resourceMetric of metrics.resourceMetrics) {
    for (const scopeMetric of resourceMetric.scopeMetrics) {
      for (const metric of scopeMetric.metrics) {
        const points = metric.sum?.dataPoints || metric.gauge?.dataPoints || [];
        result.push({ name: metric.name, points });
      }
    }
  }

  return result;
}
