import { Attributes } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import {
  MeterProvider,
  MetricReader,
  PeriodicExportingMetricReader,
  PushMetricExporter,
  ViewOptions as MetricView,
} from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { getAuthorizationHeader } from '../../utils/helpers';
import { ATTR_SESSION_ID, ATTR_VIEW_ID } from '../../instrumentation';
import { rumContextManager } from '../../context/LogzioContextManager';
import { RUMConfig } from '../../config';
import { AUTHORIZATION_HEADER, LOGZIO_REGION_HEADER, MAX_METRIC_WAIT_MS } from './constants';

export function getMetricsProvider(
  resource: Resource,
  endoint: string,
  config: RUMConfig,
): MeterProvider {
  return new MeterProvider({
    resource: resource,
    views: getMetricsViews(),
    readers: getMetricsReaders(endoint, config),
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
              const type = typeof value;
              if (type === 'string') {
                attributes[key] = value as string;
              } else if (type === 'number' || type === 'boolean') {
                attributes[key] = String(value);
              } else {
                // skip non-primitive values
              }
            }
          });
        }

        return attributes;
      },
    } as MetricView,
  ];
}

function getMetricsReaders(endoint: string, config: RUMConfig): MetricReader[] {
  return [
    new PeriodicExportingMetricReader({
      exporter: getMetricsExporter(endoint, config),
      exportIntervalMillis: MAX_METRIC_WAIT_MS,
    }),
  ];
}

function getMetricsExporter(endoint: string, config: RUMConfig): PushMetricExporter {
  return new OTLPMetricExporter({
    url: endoint,
    headers: {
      [LOGZIO_REGION_HEADER]: config.region,
      [AUTHORIZATION_HEADER]: getAuthorizationHeader(config.tokens.metrics),
    },
  });
}
