import { Attributes } from '@opentelemetry/api';
import { Resource } from '@opentelemetry/resources';
import {
  MeterProvider,
  MetricReader,
  PeriodicExportingMetricReader,
  PushMetricExporter,
  ViewOptions as MetricView,
  AggregationTemporality,
} from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { getAuthorizationHeader } from '../../utils/helpers';
import { ATTR_SESSION_ID, ATTR_VIEW_ID } from '../../instrumentation';
import { rumContextManager } from '../../context/LogzioContextManager';
import { RUMConfig } from '../../config';
import {
  AUTHORIZATION_HEADER,
  LOGZIO_DATA_TYPE_HEADER,
  LOGZIO_REGION_HEADER,
  MAX_METRIC_WAIT_MS,
} from './constants';

/**
 * Returns the metric provider.
 * It configures the metric provider with the resource, the metric views and the metric readers.
 * @param resource - The resource for the metric provider.
 * @param endpoint - The endpoint to export the metrics to.
 * @param config - The configuration for the SDK, which includes the region and the metrics token.
 * @returns Metric provider.
 */
export function getMetricsProvider(
  resource: Resource,
  endpoint: string,
  config: RUMConfig,
): MeterProvider {
  return new MeterProvider({
    resource: resource,
    views: getMetricsViews(),
    readers: getMetricsReaders(endpoint, config),
  });
}

/**
 * Returns the metric views.
 * It configures the metric view to enrich the metrics with the session and view IDs and the custom attributes.
 * @returns Metric view.
 */
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

/**
 * Returns the metric readers.
 * It configures the metric reader to export the metrics to the endpoint using OTLP metric exporter.
 * @param endpoint - The endpoint to export the metrics to.
 * @param config - The configuration for the SDK, which includes the region and the metrics token.
 * @returns Metric reader.
 */
function getMetricsReaders(endpoint: string, config: RUMConfig): MetricReader[] {
  return [
    new PeriodicExportingMetricReader({
      exporter: getMetricsExporter(endpoint, config),
      exportIntervalMillis: MAX_METRIC_WAIT_MS,
    }),
  ];
}

/**
 * Returns OTLP metric exporter.
 * It configures the metric exporter to not re-export the same metric multiple times without it's value changing.
 * ref: https://github.com/open-telemetry/opentelemetry-js/issues/3105
 * @param endpoint - The endpoint to export the metrics to.
 * @param config - The configuration for the SDK, which includes the region and the metrics token.
 * @returns OTLP metric exporter.
 */
function getMetricsExporter(endpoint: string, config: RUMConfig): PushMetricExporter {
  return new OTLPMetricExporter({
    url: endpoint,
    headers: {
      [LOGZIO_REGION_HEADER]: config.region,
      [AUTHORIZATION_HEADER]: getAuthorizationHeader(config.tokens.metrics),
      [LOGZIO_DATA_TYPE_HEADER]: 'metrics',
    },
    temporalityPreference: AggregationTemporality.DELTA,
  });
}
