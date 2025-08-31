import { Attributes } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import {
  MeterProvider,
  MetricReader,
  PeriodicExportingMetricReader,
  PushMetricExporter,
  ViewOptions as MetricView,
} from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { ATTR_SESSION_ID, ATTR_VIEW_ID } from '../../instrumentation';
import { rumContextManager } from '../../context/LogzioContextManager';
import { MAX_METRIC_WAIT_MS } from './constants';

export function getMetricsProvider(resource: Resource, endoint: string): MeterProvider {
  return new MeterProvider({
    resource: resource,
    views: getMetricsViews(),
    readers: getMetricsReaders(endoint),
  });
}

function getMetricsViews(): MetricView[] {
  return [
    {
      instrumentName: '*',
      attributeProcessor: (attributes: Attributes) => {
        const activeContext = rumContextManager.active();
        const sessionId = rumContextManager.getSessionId(activeContext);
        const viewId = rumContextManager.getViewId(activeContext);
        const customAttributes = rumContextManager.getCustomAttributes(activeContext);

        if (sessionId && attributes[ATTR_SESSION_ID] === undefined) {
          attributes[ATTR_SESSION_ID] = sessionId;
        }

        if (viewId && attributes[ATTR_VIEW_ID] === undefined) {
          attributes[ATTR_VIEW_ID] = viewId;
        }

        if (customAttributes && Object.keys(customAttributes).length > 0) {
          Object.entries(customAttributes).forEach(([key, value]) => {
            if (attributes[key] === undefined) {
              attributes[key] = value;
            }
          });
        }

        return attributes;
      },
    } as MetricView,
  ];
}

function getMetricsReaders(endoint: string): MetricReader[] {
  return [
    new PeriodicExportingMetricReader({
      exporter: getMetricsExporter(endoint),
      exportIntervalMillis: MAX_METRIC_WAIT_MS,
    }),
  ];
}

function getMetricsExporter(endoint: string): PushMetricExporter {
  return new OTLPMetricExporter({
    url: endoint,
    headers: {
      // TODO: fine tune
    },
  });
}
