import { Resource } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  SpanExporter,
  SpanProcessor,
  WebTracerProvider,
} from '@opentelemetry/sdk-trace-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { RUMConfig } from '../../config';
import {
  FrustrationDetectionProcessor,
  SessionContextSpanProcessor,
  RequestPathSpanProcessor,
} from '../processors';
import { SessionSampler } from '../samplers';
import { getAuthorizationHeader } from '../../utils/helpers';
import {
  MAX_BULK_SIZE,
  MAX_SPAN_WAIT_MS,
  LOGZIO_REGION_HEADER,
  AUTHORIZATION_HEADER,
  LOGZIO_DATA_TYPE_HEADER,
} from './constants';

export interface TraceProviderResult {
  provider: WebTracerProvider;
  sampler: SessionSampler;
}

export function getTraceProvider(
  resource: Resource,
  endpoint: string,
  config: RUMConfig,
): TraceProviderResult {
  const sampler = new SessionSampler(config.samplingRate);
  const provider = new WebTracerProvider({
    resource,
    sampler,
    spanProcessors: getSpanProcessors(endpoint, config),
  });
  return { provider, sampler };
}

function getSpanProcessors(endpoint: string, config: RUMConfig): SpanProcessor[] {
  return [
    new RequestPathSpanProcessor(),
    new SessionContextSpanProcessor(),
    ...(config.enable?.frustrationDetection ? [new FrustrationDetectionProcessor(config)] : []),
    new BatchSpanProcessor(getTraceExporter(endpoint, config), {
      maxExportBatchSize: MAX_BULK_SIZE,
      scheduledDelayMillis: MAX_SPAN_WAIT_MS,
    }),
  ];
}

function getTraceExporter(endpoint: string, config: RUMConfig): SpanExporter {
  return new OTLPTraceExporter({
    url: endpoint,
    headers: {
      [LOGZIO_REGION_HEADER]: config.region,
      [AUTHORIZATION_HEADER]: getAuthorizationHeader(config.tokens.traces),
      [LOGZIO_DATA_TYPE_HEADER]: 'traces',
    },
  });
}
